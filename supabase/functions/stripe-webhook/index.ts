import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Plan product_id → monthly credits mapping
const PLAN_CREDITS: Record<string, number> = {
  "prod_TzN6hGJodCyQY7": 500,  // Pro
  "prod_TzN7J8XxVbc6cy": 2000, // Max
};

const CREDIT_PACK_PRODUCT = "prod_TzNFL7HutpyhKK";
const CREDIT_PACK_AMOUNT = 500;

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return new Response("Missing signature or secret", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("Webhook signature verification failed", { error: err.message });
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
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
      const user = users?.users?.find(u => u.email === customerEmail);
      if (!user) {
        logStep("User not found", { email: customerEmail });
        return new Response("OK", { status: 200 });
      }

      // Check if this is a subscription renewal or credit pack
      const lineItems = invoice.lines?.data || [];
      
      for (const item of lineItems) {
        const productId = typeof item.price?.product === 'string' 
          ? item.price.product 
          : item.price?.product?.id;

        if (!productId) continue;

        // Subscription renewal
        if (PLAN_CREDITS[productId]) {
          const credits = PLAN_CREDITS[productId];
          logStep("Subscription renewal - adding credits", { userId: user.id, credits, productId });

          // Reset balance to plan credits
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
        if (productId === CREDIT_PACK_PRODUCT) {
          const qty = item.quantity || 1;
          const totalCredits = CREDIT_PACK_AMOUNT * qty;
          logStep("Credit pack purchase", { userId: user.id, totalCredits });

          // Add credits to existing balance
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
  } catch (error) {
    logStep("Error processing event", { error: error.message });
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
