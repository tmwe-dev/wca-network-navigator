import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCountryFlag, formatPartnerType } from "@/lib/countries";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentPartners() {
  const { data: partners, isLoading } = useQuery({
    queryKey: ["recent-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, city, country_code, country_name, partner_type, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Recent Partners</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/partners" className="text-primary">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))
          ) : (
            partners?.map((partner) => (
              <Link
                key={partner.id}
                to={`/partners/${partner.id}`}
                className="flex items-center gap-4 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-2xl">
                  {getCountryFlag(partner.country_code)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{partner.company_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {partner.city}, {partner.country_name}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {formatPartnerType(partner.partner_type)}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
