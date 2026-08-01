/**
 * platformToolDefs.ts - Tool definitions in OpenAI format.
 * Splittato per dominio in defs/* per LOC budget.
 */
import { TOOLS_PARTNERS_CONTACTS } from "./defs/partnersContacts.ts";
import { TOOLS_ACTIVITIES_OUTREACH } from "./defs/activitiesOutreach.ts";
import { TOOLS_INBOX_SEARCH } from "./defs/inboxSearch.ts";
import { TOOLS_OPS_MISC } from "./defs/opsMisc.ts";

export const PLATFORM_TOOLS = [
  ...TOOLS_PARTNERS_CONTACTS,
  ...TOOLS_ACTIVITIES_OUTREACH,
  ...TOOLS_INBOX_SEARCH,
  ...TOOLS_OPS_MISC,
];
