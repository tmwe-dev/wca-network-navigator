#!/usr/bin/env node
/**
 * Audit read-only della duplicazione di identità fra le tabelle sorgente.
 *
 * NON scrive nulla e NON si connette al database da solo: stampa le query di baseline
 * (eseguibili dal pannello backend) e il valore registrato all'ultima misurazione.
 * Serve a rendere ripetibile e confrontabile il contatore, non a modificare dati.
 */

const BASELINE_DATE = "2026-08-09";

const QUERIES = [
  {
    id: "row_counts",
    label: "Volumi delle tabelle sorgente",
    baseline:
      "partners 12286 | partner_contacts 137342 | imported_contacts 11414 | business_cards 383 | prospects 10 | channel_messages 20842 | activities 4666 | interactions 9",
    sql: `select 'partners' t, count(*) n from partners
union all select 'partner_contacts', count(*) from partner_contacts
union all select 'imported_contacts', count(*) from imported_contacts
union all select 'business_cards', count(*) from business_cards
union all select 'prospects', count(*) from prospects
union all select 'channel_messages', count(*) from channel_messages
union all select 'activities', count(*) from activities
union all select 'interactions', count(*) from interactions;`,
  },
  {
    id: "duplicate_emails_partner_contacts",
    label: "Email ripetute dentro partner_contacts",
    baseline: "25933 email duplicate su 26452 distinte",
    sql: `select count(*) from (
  select lower(email) e from partner_contacts
  where email is not null group by 1 having count(*) > 1
) x;`,
  },
  {
    id: "overlap_partner_imported",
    label: "Email presenti sia in partner_contacts sia in imported_contacts",
    baseline: "1274 email sovrapposte",
    sql: `select count(*) from (
  select distinct lower(email) e from partner_contacts where email is not null
) a join (
  select distinct lower(email) e from imported_contacts where email is not null
) b using (e);`,
  },
];

const wantSql = process.argv.includes("--sql");

console.log(`=== Identity duplicates audit (baseline ${BASELINE_DATE}) ===`);
for (const q of QUERIES) {
  console.log(`\n[${q.id}] ${q.label}`);
  console.log(`  baseline: ${q.baseline}`);
  if (wantSql) console.log(q.sql.replace(/^/gm, "  "));
}
if (!wantSql) console.log("\nUsa --sql per stampare le query da rieseguire.");

process.exit(0);
