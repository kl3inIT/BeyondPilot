import {
  adminEmailMessageRoute,
  adminEmailTemplateRoute,
  adminProgramRoute,
  siteRoutes,
} from "@/lib/site";

/**
 * The kinds of email of the enquiries and introductions that Messages replaced. The log keeps the
 * events that changed their wording.
 */
const retiredEmailKinds = new Set([
  "talent_enquiry",
  "talent_enquiry_reminder",
  "talent_introduction",
  "talent_enquiry_declined",
  "talent_enquiry_closed",
  "introduction_request",
  "introduction_made",
  "introduction_declined",
]);

/** The page of a record, by the type the backend files it under in the audit log. */
const recordRoutes: Record<string, (id: string) => string | null> = {
  organization: (id) => `${siteRoutes.adminOrganizations}/${id}`,
  solution: (id) => `${siteRoutes.adminSolutions}/${id}`,
  solution_offer: (id) => `${siteRoutes.adminOffers}/${id}`,
  talent: (id) => `${siteRoutes.adminTalent}/${id}`,
  use_case: (id) => `${siteRoutes.adminUseCases}/${id}`,
  program: adminProgramRoute,
  email_message: adminEmailMessageRoute,
  // The wording of a kind of email that is no longer sent has no page.
  email_template: (kind) => (retiredEmailKinds.has(kind) ? null : adminEmailTemplateRoute(kind)),
  // A setting has no record: its page is the one that holds it.
  email_settings: () => siteRoutes.adminEmailSettings,
  search_settings: () => siteRoutes.adminSearchIndex,
  search_index: () => siteRoutes.adminSearchIndex,
  matching_settings: () => siteRoutes.adminAiMatching,
  mcp_settings: () => siteRoutes.adminMcp,
};

/** The actions after which the record is gone, so its name leads nowhere. */
const endings = new Set(["talent.delete", "solution.offer_delete"]);

/**
 * Where the resource of an audit event is read in the admin area, or null when the app has no page
 * for its kind (an account, a conversation, an AI provider, an address) or the event deleted it.
 */
export function auditResourceRoute(event: {
  action: string;
  resource: { type: string; id: string };
}): string | null {
  if (endings.has(event.action)) {
    return null;
  }
  const { type, id } = event.resource;
  // The type is the backend's word; one this list lacks must not find a member of every object.
  return Object.hasOwn(recordRoutes, type) ? recordRoutes[type](id) : null;
}
