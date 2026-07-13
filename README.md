# HRW real Stripe store

This is the user's HRW design converted into a Node.js ecommerce project.

## Included

- Real Stripe-hosted payments
- Delivery pricing by region
- Shipping address, email and phone collection
- Secure webhook verification
- Automatic paid-order email to HRW through Resend
- Customer order-confirmation email through Resend
- Stripe receipt support
- Stripe success/cancellation pages
- Persistent cart, sizes and quantities

## 1. Install

Install Node.js 20 or newer. Open a terminal in this folder and run:

```bash
npm install
```

Copy `.env.example` to `.env` and replace every placeholder.

## 2. Stripe keys

In Stripe Dashboard, open **Developers > API keys**. Copy the test secret key into `STRIPE_SECRET_KEY`.

Never put a secret key inside HTML or upload `.env` publicly.

Enable customer receipts in **Settings > Customer emails > Successful payments**.

Install the Stripe Dashboard app on your phone and enable new-payment notifications.

## 3. Test the webhook locally

Install Stripe CLI, sign in and run:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Copy the displayed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

Start the site:

```bash
npm run dev
```

Open `http://localhost:3000`.

Stripe test card:

```text
4242 4242 4242 4242
```

Use any future expiry and any three-digit CVC.

## 4. Email setup

Create a Resend account, verify a domain and create an API key.

Set:

```text
RESEND_API_KEY
EMAIL_FROM
ORDER_NOTIFICATION_EMAIL
```

`ORDER_NOTIFICATION_EMAIL` is where the paid-order packing email is delivered.

## 5. Deploy

Deploy this whole folder to a Node-compatible service such as Railway or Render. Add all `.env` variables in the host's settings and set `PUBLIC_URL` to the final HTTPS URL.

In Stripe Dashboard, create a webhook endpoint:

```text
https://YOUR-DOMAIN/api/stripe-webhook
```

Subscribe to `checkout.session.completed`, then copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on the host.

## Delivery pricing

Edit `catalog.js` to change the amounts and countries.

Current starter rates:

- UK: £3.99
- Ireland: £8.99
- Europe: £11.99
- Selected international countries: £17.99

These are fixed prices, not live Royal Mail quotes. Check packaging and postage costs before launch.

## Before taking live orders

- Complete Stripe identity and bank verification.
- Test the whole order flow in test mode.
- Confirm all delivery rates, returns wording and sizing.
- Switch from Stripe test keys to live keys only after testing.
- Always verify an order is marked paid in Stripe before dispatching it.
