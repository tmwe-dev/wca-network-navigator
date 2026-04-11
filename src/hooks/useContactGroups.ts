import { useQuery } from "@tanstack/react-query";
import { rpcGetContactGroupCounts } from "@/data/rpc";

export interface ContactGroupCount {
  group_type: string;
  group_key: string;
  group_label: string;
  contact_count: number;
  with_email: number;
  with_phone: number;
  with_deep_search: number;
  with_alias: number;
}

const GROUP_COUNTS_KEY = ["contact-group-counts"] as const;

/** Fetches group counts for ALL contacts from the database via RPC */
export function useContactGroupCounts() {
  return useQuery({
    queryKey: GROUP_COUNTS_KEY,
    queryFn: async () => {
      const data = await rpcGetContactGroupCounts();
      return data as ContactGroupCount[];
      return (data ?? []) as ContactGroupCount[];
    },
    staleTime: 30_000,
  });
}

/** Returns contacts for a specific group value, with pagination */
export function useContactsByGroup(
  groupType: string | null,
  groupKey: string | null,
  page: number = 0,
  pageSize: number = 200,
  enabled: boolean = false,
  holdingPattern?: "out" | "in" | "all"
) {
  return useQuery({
    queryKey: ["contacts-by-group", groupType, groupKey, page, pageSize, holdingPattern],
    enabled: enabled && !!groupType && !!groupKey,
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Quality filter
      q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

      // Holding pattern filter
      if (holdingPattern === "out") q = q.eq("interaction_count", 0);
      else if (holdingPattern === "in") q = q.gt("interaction_count", 0);

      // Apply group filter
      switch (groupType) {
        case "country":
          if (groupKey === "??" || groupKey === "Sconosciuto") {
            q = q.is("country", null);
          } else {
            q = q.eq("country", groupKey!);
          }
          break;
        case "origin":
          if (groupKey === "Sconosciuta") {
            q = q.is("origin", null);
          } else {
            q = q.eq("origin", groupKey!);
          }
          break;
        case "status":
          q = q.eq("lead_status", groupKey!);
          break;
        case "date":
          if (groupKey === "nd") {
            q = q.is("created_at", null);
          } else {
            // groupKey is "YYYY-MM"
            q = q.gte("created_at", `${groupKey}-01T00:00:00Z`)
                 .lt("created_at", nextMonth(groupKey!));
          }
          break;
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
    },
  });
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // month is 0-indexed, so m (1-indexed) gives next month
  return d.toISOString();
}
