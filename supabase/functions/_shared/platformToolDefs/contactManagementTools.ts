/**
 * contactManagementTools.ts — Partner contact management tool definitions.
 */

export const CONTACT_MANAGEMENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "delete"] },
          contact_id: { type: "string" },
          partner_id: { type: "string" },
          company_name: { type: "string" },
          name: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          direct_phone: { type: "string" },
          mobile: { type: "string" },
          is_primary: { type: "boolean" },
        },
        required: ["action"],
      },
    },
  },
];
