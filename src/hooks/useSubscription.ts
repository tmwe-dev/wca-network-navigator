import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTierByProductId, type SubscriptionTier } from "@/config/subscriptionTiers";

interface SubscriptionState {
  loading: boolean;
  subscribed: boolean;
  tier: SubscriptionTier;
  subscriptionEnd: string | null;
  productId: string | null;
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    loading: true,
    subscribed: false,
    tier: "free",
    subscriptionEnd: null,
    productId: null,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      const tier = getTierByProductId(data.product_id);
      setState({
        loading: false,
        subscribed: data.subscribed ?? false,
        tier,
        subscriptionEnd: data.subscription_end ?? null,
        productId: data.product_id ?? null,
      });
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    checkSubscription();

    const interval = setInterval(checkSubscription, 60_000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") checkSubscription();
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [checkSubscription]);

  const startCheckout = async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) window.open(data.url, "_blank");
  };

  const openPortal = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) window.open(data.url, "_blank");
  };

  return { ...state, checkSubscription, startCheckout, openPortal };
}
