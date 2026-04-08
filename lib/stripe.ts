import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export const PLANS = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER!,
    credits: 500,
    plan: "starter",
  },
  pro: {
    name: "PRO",
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: 2000,
    plan: "pro",
  },
  agency: {
    name: "Agency",
    priceId: process.env.STRIPE_PRICE_AGENCY!,
    credits: 10000,
    plan: "agency",
  },
  premium: {
    name: "Premium",
    priceId: process.env.STRIPE_PRICE_PREMIUM!,
    credits: 50000,
    plan: "premium",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── One-time credit top-up packages ──────────────────────────────────────────
export const CREDIT_PACKAGES = {
  small:  { credits: 100,  price: "R$ 9",  label: "100 créditos",  priceId: process.env.STRIPE_PRICE_TOPUP_SMALL!  },
  medium: { credits: 300,  price: "R$ 19", label: "300 créditos",  priceId: process.env.STRIPE_PRICE_TOPUP_MEDIUM! },
  large:  { credits: 1000, price: "R$ 49", label: "1000 créditos", priceId: process.env.STRIPE_PRICE_TOPUP_LARGE! },
} as const;

export type PackageKey = keyof typeof CREDIT_PACKAGES;
