export const PRODUCTS = {
  "apex-black-white": { name: "HRW Black Race Underwear", pricePence: 1599 },
  "apex-black-gold": { name: "HRW Gold Race Underwear", pricePence: 1599 },
  "apex-white-black": { name: "HRW White Race Underwear", pricePence: 1599 },
  "apex-black-pink": { name: "HRW Pink Race Underwear", pricePence: 1599 },
  "apex-white-pink": { name: "HRW White Pink Race Underwear", pricePence: 1599 }
};

export const SHIPPING = {
  GB: { name: "UK Standard Delivery", amountPence: 399, minDays: 2, maxDays: 5, allowedCountries: ["GB"] },
  IE: { name: "Ireland Tracked Delivery", amountPence: 899, minDays: 3, maxDays: 7, allowedCountries: ["IE"] },
  EU: { name: "Europe Tracked Delivery", amountPence: 1199, minDays: 4, maxDays: 10, allowedCountries: ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"] },
  INTL: { name: "International Tracked Delivery", amountPence: 1799, minDays: 7, maxDays: 18, allowedCountries: ["US","CA","AU","NZ","JP","SG","AE","CH","NO"] }
};
