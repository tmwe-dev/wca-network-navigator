/**
 * DAL — partner_contacts, partner_networks, partner_services, partner_certifications, partner_social_links
 * Centralizes queries on partner relation tables.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PartnerContactRow = Database["public"]["Tables"]["partner_contacts"]["Row"];
type PartnerContactInsert = Database["public"]["Tables"]["partner_contacts"]["Insert"];
type PartnerSocialLinkRow = Database["public"]["Tables"]["partner_social_links"]["Row"];
type PartnerSocialLinkInsert = Database["public"]["Tables"]["partner_social_links"]["Insert"];

// ── partner_contacts ──
export async function findPartnerContacts(partnerId: string, select = "id, name, email, direct_phone, mobile, title, contact_alias"): Promise<Partial<PartnerContactRow>[]> {
  const { data, error } = await supabase.from("partner_contacts").select(select).eq("partner_id", partnerId);
  if (error) throw error;
  return (data ?? []) as Partial<PartnerContactRow>[];
}

export async function findPartnerContactByEmail(email: string) {
  const { data, error } = await supabase
    .from("partner_contacts")
    .select("partner_id, name, contact_alias, email, partners(company_name, company_alias, country_code, city)")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertPartnerContact(contact: Record<string, unknown>) {
  const { data, error } = await supabase.from("partner_contacts").insert(contact as PartnerContactInsert).select().single();
  if (error) throw error;
  return data;
}

export async function updatePartnerContact(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("partner_contacts").update(updates).eq("id", id);
  if (error) throw error;
}

export async function insertPartnerContacts(contacts: Record<string, unknown>[]) {
  if (contacts.length === 0) return;
  const { error } = await supabase.from("partner_contacts").insert(contacts as PartnerContactInsert[]);
  if (error) throw error;
}

export async function countPartnerContacts() {
  const { count, error } = await supabase.from("partner_contacts").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// ── partner_networks ──
export async function findPartnerNetworks(partnerId: string) {
  const { data, error } = await supabase.from("partner_networks").select("network_name").eq("partner_id", partnerId);
  if (error) throw error;
  return data ?? [];
}

export async function insertPartnerNetworks(networks: Record<string, unknown>[]) {
  if (networks.length === 0) return;
  const { error } = await supabase.from("partner_networks").insert(networks as Database["public"]["Tables"]["partner_networks"]["Insert"][]);
  if (error) throw error;
}

// ── partner_services ──
export async function findPartnerServices(partnerId: string) {
  const { data, error } = await supabase.from("partner_services").select("service_category").eq("partner_id", partnerId);
  if (error) throw error;
  return data ?? [];
}

export async function insertPartnerServices(services: Record<string, unknown>[]) {
  if (services.length === 0) return;
  const { error } = await supabase.from("partner_services").insert(services as Database["public"]["Tables"]["partner_services"]["Insert"][]);
  if (error) throw error;
}

// ── partner_certifications ──
export async function findPartnerCertifications(partnerId: string) {
  const { data, error } = await supabase.from("partner_certifications").select("certification").eq("partner_id", partnerId);
  if (error) throw error;
  return data ?? [];
}

export async function insertPartnerCertifications(certs: Record<string, unknown>[]) {
  if (certs.length === 0) return;
  const { error } = await supabase.from("partner_certifications").insert(certs as Database["public"]["Tables"]["partner_certifications"]["Insert"][]);
  if (error) throw error;
}

// ── partner_social_links ──
export async function findPartnerSocialLinks(partnerId: string) {
  const { data, error } = await supabase.from("partner_social_links").select("*").eq("partner_id", partnerId);
  if (error) throw error;
  return data ?? [];
}

export async function findSocialLinksByPartnerIds(partnerIds: string[], platform?: string) {
  let q = supabase.from("partner_social_links").select("partner_id, contact_id, platform, url").in("partner_id", partnerIds);
  if (platform) q = q.eq("platform", platform);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function insertPartnerSocialLink(link: { partner_id: string; contact_id: string | null; platform: string; url: string }) {
  const { error } = await supabase.from("partner_social_links").insert(link as PartnerSocialLinkInsert);
  return { error };
}

// ── partner_contacts by IDs ──
export async function getPartnerContactsByIds(ids: string[], select = "id, name, title, email, direct_phone, mobile, partner_id, contact_alias"): Promise<Partial<PartnerContactRow>[]> {
  const { data, error } = await supabase.from("partner_contacts").select(select).in("id", ids);
  if (error) throw error;
  return (data ?? []) as Partial<PartnerContactRow>[];
}

// ── prospect_contacts by IDs ──
export async function getProspectContactsByIds(ids: string[], select = "id, name, role, email, phone, prospect_id, linkedin_url"): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from("prospect_contacts").select(select).in("id", ids);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}
