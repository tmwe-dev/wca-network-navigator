import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// ── Product ID constants ──
const PRODUCT_PRO = "prod_TzN6hGJodCyQY7";
const PRODUCT_MAX = "prod_TzN7J8XxVbc6cy";
const PRODUCT_CREDIT_PACK_500 = "prod_TzNFL7HutpyhKK";

const PLAN_CREDITS: Record<string, number> = {
  [PRODUCT_PRO]: 500,
  [PRODUCT_MAX]: 2000,
};

const CREDIT_PACK_AMOUNT = 500;

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return edgeError("AUTH_REQUIRED", "Missing signature or secret");
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (e: unknown) {
    logStep("Webhook signature verification failed", { error: extractErrorMessage(e) });
    return edgeError("AUTH_INVALID", `Webhook signature verification failed: ${extractErrorMessage(e)}`);
  }

  logStep("Event received", { type: event.type, id: event.id });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerEmail = invoice.customer_email;
      
      if (!customerEmail) {
        logStep("No customer email on invoice");
        return new Response("OK", { status: 200 });
      }

      // Find user by email
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users?.users?.find((u: { email?: string }) => u.email === customerEmail);
      if (!user) {
        logStep("User not found", { email: customerEmail });
        return new Response("OK", { status: 200 });
      }

      const lineItems = invoice.lines?.data || [];
      
      for (const item of lineItems) {
        const productId = typeof item.price?.product === 'string' 
          ? item.price.product 
          : (item.price?.product as Stripe.Product | undefined)?.id;

        if (!productId) continue;

        // Subscription renewal
        if (PLAN_CREDITS[productId]) {
          const credits = PLAN_CREDITS[productId];
          logStep("Subscription renewal - adding credits", { userId: user.id, credits, productId });

          await supabaseAdmin
            .from("user_credits")
            .update({ balance: credits })
            .eq("user_id", user.id);

          await supabaseAdmin
            .from("credit_transactions")
            .insert({
              user_id: user.id,
              amount: credits,
              operation: "subscription_renewal",
              description: `Rinnovo piano - ${credits} crediti`,
            });
        }

        // Credit pack purchase
        if (productId === PRODUCT_CREDIT_PACK_500) {
          const qty = item.quantity || 0;
          if (qty <= 0) {
            logStep("Skipping credit pack with invalid quantity", { qty });
            continue;
          }
          const totalCredits = CREDIT_PACK_AMOUNT * qty;
          logStep("Credit pack purchase", { userId: user.id, totalCredits });

          const { data: current } = await supabaseAdmin
            .from("user_credits")
            .select("balance")
            .eq("user_id", user.id)
            .single();

          const newBalance = (current?.balance || 0) + totalCredits;

          await supabaseAdmin
            .from("user_credits")
            .update({ balance: newBalance })
            .eq("user_id", user.id);

          await supabaseAdmin
            .from("credit_transactions")
            .insert({
              user_id: user.id,
              amount: totalCredits,
              operation: "topup",
              description: `Acquisto ${totalCredits} crediti extra`,
            });
        }
      }
    }
  } catch (e: unknown) {
    logStep("Error processing event", { error: extractErrorMessage(e) });
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e));
  }

  return new Response("OK", { status: 200 });
});
