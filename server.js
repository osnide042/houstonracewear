import "dotenv/config";
import express from "express";
import Stripe from "stripe";
import { Resend } from "resend";
import { PRODUCTS, SHIPPING } from "./catalog.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const app = express();
const port = process.env.PORT || 3000;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[ch]);
}

function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 30) throw new Error("Your bag is empty or invalid.");
  return cart.map(item => {
    const product = PRODUCTS[item.id];
    const quantity = Number(item.quantity);
    const size = String(item.size || "").toUpperCase();
    if (!product) throw new Error("A product in your bag is unavailable.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("Invalid quantity.");
    if (!["XS","S","M","L","XL","XXL"].includes(size)) throw new Error("Invalid size.");
    return { id: item.id, product, quantity, size };
  });
}

// Must come before express.json() so Stripe receives the untouched request body.
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Webhook signature failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        await sendOrderEmails(session, lineItems.data);
      } catch (error) {
        console.error("Order email failed:", error);
        return res.status(500).json({ received: true, emailError: true });
      }
    }
  }
  res.json({ received: true });
});

app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const items = validateCart(req.body.cart);
    const shipping = SHIPPING[req.body.shippingRegion];
    if (!shipping) throw new Error("Choose a valid delivery region.");
    const publicUrl = String(process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
    const orderReference = `HRW-${Date.now().toString().slice(-9)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map(({ id, product, quantity, size }) => ({
        quantity,
        price_data: {
          currency: "gbp",
          unit_amount: product.pricePence,
          product_data: {
            name: product.name,
            description: `Size ${size}`,
            metadata: { product_id: id, size }
          }
        }
      })),
      customer_creation: "always",
      shipping_address_collection: { allowed_countries: shipping.allowedCountries },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shipping.amountPence, currency: "gbp" },
          display_name: shipping.name,
          delivery_estimate: {
            minimum: { unit: "business_day", value: shipping.minDays },
            maximum: { unit: "business_day", value: shipping.maxDays }
          }
        }
      }],
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
      metadata: { order_reference: orderReference, shipping_region: req.body.shippingRegion },
      payment_intent_data: { metadata: { order_reference: orderReference } },
      success_url: `${publicUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl}/cancel.html`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Checkout could not be created." });
  }
});

app.get("/api/order-status", async (req, res) => {
  try {
    const id = String(req.query.session_id || "");
    if (!id.startsWith("cs_")) return res.status(400).json({ error: "Invalid session." });
    const session = await stripe.checkout.sessions.retrieve(id);
    res.json({
      paid: session.payment_status === "paid",
      orderReference: session.metadata?.order_reference || session.id,
      amount: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((session.amount_total || 0) / 100),
      email: session.customer_details?.email || ""
    });
  } catch {
    res.status(400).json({ error: "Order could not be found." });
  }
});

async function sendOrderEmails(session, lineItems) {
  if (!resend) {
    console.warn("No RESEND_API_KEY: payment succeeded, but custom emails were skipped.");
    return;
  }

  const details = session.customer_details || {};
  const shippingDetails = session.collected_information?.shipping_details || session.shipping_details || {};
  const address = shippingDetails.address || details.address || {};
  const customerEmail = details.email;
  const orderReference = session.metadata?.order_reference || session.id;
  const total = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((session.amount_total || 0) / 100);
  const from = process.env.EMAIL_FROM || "HRW Orders <orders@example.com>";

  const itemRows = lineItems.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.description)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">£${((item.amount_total || 0)/100).toFixed(2)}</td></tr>`).join("");
  const addressHtml = [shippingDetails.name || details.name, address.line1, address.line2, address.city, address.state, address.postal_code, address.country].filter(Boolean).map(escapeHtml).join("<br>");

  if (process.env.ORDER_NOTIFICATION_EMAIL) {
    await resend.emails.send({
      from,
      to: process.env.ORDER_NOTIFICATION_EMAIL,
      subject: `New paid HRW order ${orderReference} — ${total}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h1>New paid HRW order</h1><p><strong>Order:</strong> ${escapeHtml(orderReference)}<br><strong>Total:</strong> ${escapeHtml(total)}<br><strong>Customer:</strong> ${escapeHtml(details.name || "")}<br><strong>Email:</strong> ${escapeHtml(customerEmail || "")}<br><strong>Phone:</strong> ${escapeHtml(details.phone || "")}</p><table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:8px">Item / size</th><th>Qty</th><th style="text-align:right">Price</th></tr>${itemRows}</table><h2>Package and send to</h2><p>${addressHtml}</p><p>Verify the payment in Stripe before dispatching.</p></div>`
    });
  }

  if (customerEmail) {
    await resend.emails.send({
      from,
      to: customerEmail,
      subject: `HRW order confirmed — ${orderReference}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h1>Thanks for your HRW order</h1><p>Your payment has been received and your order is being prepared.</p><p><strong>Order reference:</strong> ${escapeHtml(orderReference)}<br><strong>Total paid:</strong> ${escapeHtml(total)}</p><table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:8px">Item / size</th><th>Qty</th><th style="text-align:right">Price</th></tr>${itemRows}</table><h2>Delivery address</h2><p>${addressHtml}</p><p>Keep your Stripe receipt and order reference.</p></div>`
    });
  }
}

app.listen(port, () => console.log(`HRW store running at http://localhost:${port}`));
