import { useState, useEffect, useCallback } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { getTierByProductId, type SubscriptionTier } from "@/config/subscriptionTiers";
import { createLogger } from "@/lib/log";
import { useAuth } from "@/providers/AuthProvider";

const log = createLogger("useSubscription");

type CheckSubscriptionResult = { subscribed?: boolean; product_id?: string | null; subscription_end?: string | null };
type CheckoutResult = { url?: string };

interface SubscriptionState {
  loading: boolean;
  subscribed: boolean;
  tier: SubscriptionTier;
  subscriptionEnd: string | null;
  productId: string | null;
}

export function useSubscription() {
  const { event } = useAuth();

  const [state, setState] = useState<SubscriptionState>({
    loading: true,
    subscribed: false,
    tier: "free",
    subscriptionEnd: null,
    productId: null,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const data = await invokeEdge<CheckSubscriptionResult>("check-subscription", {
        context: "useSubscription.check",
      });

      const tier = getTierByProductId(data?.product_id ?? null);
      setState({
        loading: false,
        subscribed: data?.subscribed ?? false,
        tier,
        subscriptionEnd: data?.subscription_end ?? null,
        productId: data?.product_id ?? null,
      });
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  // Re-check on sign-in (sourced from AuthProvider)
  useEffect(() => {
    if (event === "SIGNED_IN") checkSubscription();
  }, [event, checkSubscription]);

  const startCheckout = async (priceId: string) => {
    const data = await invokeEdge<CheckoutResult>("create-checkout", {
      body: { priceId },
      context: "useSubscription.startCheckout",
    });
    if (data?.url) window.open(data.url, "_blank");
  };

  const openPortal = async () => {
    const data = await invokeEdge<CheckoutResult>("customer-portal", {
      context: "useSubscription.openPortal",
    });
    if (data?.url) window.open(data.url, "_blank");
  };

  return { ...state, checkSubscription, startCheckout, openPortal };
}
