import {
  adminEmailMessageRoute,
  adminEmailTemplateRoute,
  adminProgramRoute,
  siteRoutes,
} from "@/lib/site";

/** The page of a record, by the type the backend files it under in the audit log. */
const recordRoutes: Record<string, (id: string) => string> = {
  organization: (id) => `${siteRoutes.adminOrganizations}/${id}`,
  solution: (id) => `${siteRoutes.adminSolutions}/${id}`,
  solution_offer: (id) => `${siteRoutes.adminOffers}/${id}`,
  talent: (id) => `${siteRoutes.adminTalent}/${id}`,
  use_case: (id) => `${siteRoutes.adminUseCases}/${id}`,
  program: adminProgramRoute,
  email_message: adminEmailMessageRoute,
  email_template: adminEmailTemplateRoute,
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
 * for its kind (an account, an AI provider, an address) or the event deleted it.
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
