// Stripe product/price mapping for subscription tiers
export const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    product_id: null,
    price_id: null,
    price: 0,
    features: [
      "Accesso base alla directory WCA",
      "Fino a 100 partner salvati",
      "Ricerca partner manuale",
      "100 crediti AI di benvenuto",
    ],
    limits: {
      partners: 100,
      campaigns_per_month: 0,
      ai_credits_included: 0,
      email_templates: 3,
    },
  },
  pro: {
    name: "Pro",
    product_id: "prod_TzN6hGJodCyQY7",
    price_id: "price_1T1OLrRwUJ1hMnnPgcmTlDah",
    price: 49,
    features: [
      "Tutto del piano Free",
      "Partner illimitati",
      "Automazione campagne CRM",
      "500 crediti AI/mese inclusi",
      "Download contatti automatizzato",
      "Supporto prioritario",
    ],
    limits: {
      partners: Infinity,
      campaigns_per_month: 50,
      ai_credits_included: 500,
      email_templates: 20,
    },
  },
  max: {
    name: "Max",
    product_id: "prod_TzN7J8XxVbc6cy",
    price_id: "price_1T1ONfRwUJ1hMnnPiInlOAJr",
    price: 99,
    features: [
      "Tutto del piano Pro",
      "Gestione email avanzata",
      "2000 crediti AI/mese inclusi",
      "Analisi AI dei partner",
      "Template email illimitati",
      "Supporto dedicato",
    ],
    limits: {
      partners: Infinity,
      campaigns_per_month: Infinity,
      ai_credits_included: 2000,
      email_templates: Infinity,
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

export function getTierByProductId(productId: string | null): SubscriptionTier {
  if (!productId) return "free";
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.product_id === productId) return key as SubscriptionTier;
  }
  return "free";
}

// Token pricing model for AI consumption margin calculation
export const TOKEN_PRICING = {
  // Cost per 1K tokens (our cost from providers)
  provider_cost: {
    openai: { input: 0.0025, output: 0.01 },
    google: { input: 0.00125, output: 0.005 },
    anthropic: { input: 0.003, output: 0.015 },
  },
  // Credits per 1K tokens (what we charge users)
  credits_per_1k_tokens: {
    openai: { input: 1, output: 4 },
    google: { input: 1, output: 2 },
    anthropic: { input: 1, output: 5 },
  },
  // Approximate tokens per credit (for display)
  tokens_per_credit: 1000,
} as const;

// Credit packs for extra purchases
export const CREDIT_PACKS = {
  pack_500: {
    credits: 500,
    price: 10,
    price_id: "price_1T1OUpRwUJ1hMnnPL9UTEoB2",
    product_id: "prod_TzNFL7HutpyhKK",
  },
} as const;
