import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_TIERS, type SubscriptionTier, TOKEN_PRICING, CREDIT_PACKS } from "@/config/subscriptionTiers";
import { Check, Crown, Loader2, ExternalLink, Zap, Calculator, Coins, ShoppingCart, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

export function SubscriptionPanel() {
  const { tier, subscribed, subscriptionEnd, loading, startCheckout, openPortal, checkSubscription } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [totalConsumed, setTotalConsumed] = useState<number>(0);

  useEffect(() => {
    const fetchCredits = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("user_credits")
        .select("balance, total_consumed")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        setCreditBalance(data.balance);
        setTotalConsumed(data.total_consumed);
      }
    };
    fetchCredits();
  }, []);

  const handleCheckout = async (priceId: string, tierKey: string) => {
    setCheckoutLoading(tierKey);
    try { await startCheckout(priceId); }
    catch (e: unknown) { toast.error((e instanceof Error ? e.message : String(e)) || "Errore nell'apertura del checkout"); }
    finally { setCheckoutLoading(null); }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try { await openPortal(); }
    catch (e: unknown) { toast.error((e instanceof Error ? e.message : String(e)) || "Errore nell'apertura del portale"); }
    finally { setPortalLoading(false); }
  };

  const handleBuyCredits = async () => {
    setBuyingCredits(true);
    try {
      const data = await invokeEdge<Record<string, unknown>>("buy-credits", { body: { quantity: 1 }, context: "SubscriptionPanel.buy_credits" });
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: unknown) { toast.error((e instanceof Error ? e.message : String(e)) || "Errore nell'acquisto crediti"); }
    finally { setBuyingCredits(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const tierEntries = Object.entries(SUBSCRIPTION_TIERS) as [SubscriptionTier, typeof SUBSCRIPTION_TIERS[SubscriptionTier]][];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Piano Abbonamento</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border border-primary/20">
            Piano {SUBSCRIPTION_TIERS[tier].name}
          </Badge>
          {subscriptionEnd && (
            <span className="text-xs text-muted-foreground">
              Rinnovo: {new Date(subscriptionEnd).toLocaleDateString("it-IT")}
            </span>
          )}
        </div>
      </div>

      <Tabs defaultValue="piano" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="piano" className="gap-1.5 text-xs">
            <CreditCard className="w-3.5 h-3.5" /> Piano
          </TabsTrigger>
          <TabsTrigger value="crediti" className="gap-1.5 text-xs">
            <Coins className="w-3.5 h-3.5" /> Crediti
          </TabsTrigger>
          <TabsTrigger value="token" className="gap-1.5 text-xs">
            <Calculator className="w-3.5 h-3.5" /> Token
          </TabsTrigger>
        </TabsList>

        {/* Piano */}
        <TabsContent value="piano" className="m-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {tierEntries.map(([key, t]) => {
              const isCurrent = key === tier;
              const isUpgrade = tierEntries.findIndex(([k]) => k === key) > tierEntries.findIndex(([k]) => k === tier);
              return (
                <Card key={key} className={isCurrent ? "border-primary ring-2 ring-primary/20" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{t.name}</CardTitle>
                      {isCurrent && <Badge variant="default" className="text-xs">Il tuo piano</Badge>}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">€{t.price}</span>
                      {t.price > 0 && <span className="text-muted-foreground text-sm">/mese</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {t.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      subscribed ? (
                        <Button variant="outline" className="w-full" onClick={handlePortal} disabled={portalLoading}>
                          {portalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                          Gestisci Abbonamento
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full" disabled>Piano attuale</Button>
                      )
                    ) : t.price_id ? (
                      <Button className="w-full" variant={isUpgrade ? "default" : "outline"} onClick={() => handleCheckout(t.price_id!, key)} disabled={checkoutLoading === key}>
                        {checkoutLoading === key ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                        {isUpgrade ? "Upgrade" : "Cambia piano"}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { checkSubscription(); toast.success("Stato aggiornato"); }}>
              Aggiorna stato abbonamento
            </Button>
          </div>
        </TabsContent>

        {/* Crediti */}
        <TabsContent value="crediti" className="m-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">Crediti AI</CardTitle>
                </div>
                <Badge variant="outline" className="text-lg font-bold px-3 py-1">
                  {creditBalance !== null ? creditBalance : "..."} crediti
                </Badge>
              </div>
              <CardDescription>
                Totale consumati: {totalConsumed} crediti • BYOK = consumo illimitato senza crediti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Pacchetto Extra</p>
                  <p className="text-xs text-muted-foreground">{CREDIT_PACKS.pack_500.credits} crediti — €{CREDIT_PACKS.pack_500.price}</p>
                </div>
                <Button size="sm" onClick={handleBuyCredits} disabled={buyingCredits}>
                  {buyingCredits ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                  Acquista
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token Calculator */}
        <TabsContent value="token" className="m-0">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Calcolatore Token</CardTitle>
              </div>
              <CardDescription>
                Costo in crediti per operazione AI. Porta le tue chiavi API per risparmiare.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.entries(TOKEN_PRICING.credits_per_1k_tokens) as [string, { input: number; output: number }][]).map(([provider, costs]) => (
                  <div key={provider} className="rounded-lg border p-3 space-y-1">
                    <p className="font-medium text-sm capitalize">{provider}</p>
                    <p className="text-xs text-muted-foreground">Input: {costs.input} crediti / 1K token</p>
                    <p className="text-xs text-muted-foreground">Output: {costs.output} crediti / 1K token</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 Con le tue chiavi API paghi solo il costo del provider, senza consumare crediti.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
