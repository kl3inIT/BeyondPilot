/** Site-wide destinations. Routes without a page yet render the shared coming-soon page. */
export const siteRoutes = {
  home: "/",
  programs: "/programs",
  useCases: "/use-cases",
  solutions: "/solutions",
  organizations: "/organizations",
  talent: "/talent",
  signIn: "/sign-in",
  getStarted: "/get-started",
  publishUseCase: "/use-cases/new",
  talentProfile: "/workspace/talent",
  founders: "/founders",
  search: "/search",
  admin: "/admin",
  adminPrograms: "/admin/programs",
  adminAccounts: "/admin/accounts",
  adminAuditLog: "/admin/audit-log",
  adminOrganizations: "/admin/organizations",
  adminSolutions: "/admin/solutions",
  adminTalent: "/admin/talent",
  adminTalentReported: "/admin/talent/reported",
  adminIntroductions: "/admin/introductions",
  adminEmail: "/admin/email",
  adminEmailTemplates: "/admin/email/templates",
  adminEmailAppearance: "/admin/email/appearance",
  adminEmailActivity: "/admin/email/activity",
  adminEmailSuppressions: "/admin/email/suppressions",
  adminEmailSettings: "/admin/email/settings",
  workspaceOrganization: "/workspace/organization",
  myApplications: "/applications",
  reviews: "/reviews",
  workspaceMembers: "/workspace/organization/members",
  workspaceSolutions: "/workspace/organization/solutions",
  workspaceIntroductions: "/workspace/organization/introductions",
} as const;

/** The host the public site is served from, as an operator sees a program's address written out. */
export const publicSiteHost = "beyondpilot.genaifund.ai";

/** A program's public page. */
export function programRoute(slug: string) {
  return `${siteRoutes.programs}/${slug}`;
}

/**
 * Where a program takes applications, while the application form of BeyondPilot is being built
 * (BEY-37): the Tasco challenge still takes them on its interim page. A program without one shows
 * no Apply button.
 */
/**
 * Where Apply leads for a program that takes applications: its form on BeyondPilot. The AI for
 * Insurance Challenge keeps its interim form until it closes on 15 October 2026.
 */
export function programApplyUrl(slug: string): string {
  return slug === "insurance-ai-tasco" ? `${liveCampaignUrl}/apply` : `${programRoute(slug)}/apply`;
}

/** One kind of email's wording in the admin area. */
export function adminEmailTemplateRoute(kind: string) {
  return `${siteRoutes.adminEmailTemplates}/${kind}`;
}

/** One sent email in the admin area's log. */
export function adminEmailMessageRoute(id: string) {
  return `${siteRoutes.adminEmailActivity}/${id}`;
}

/** A program's Settings in the admin area, the screen a program opens on. */
/** Where an operator sets the questions a program's application form asks. */
export function adminProgramQuestionsRoute(id: string) {
  return `${siteRoutes.adminPrograms}/${id}/questions`;
}

export function adminProgramRoute(id: string) {
  return `${siteRoutes.adminPrograms}/${id}/settings`;
}

/** The applications of a program as GenAI Fund reviews them; one opens under it. */
export function adminProgramApplicationsRoute(id: string) {
  return `${siteRoutes.adminPrograms}/${id}/applications`;
}

/** Where GenAI Fund releases a program's outcomes. */
export function adminProgramReleaseRoute(id: string) {
  return `${siteRoutes.adminPrograms}/${id}/release`;
}

/** A program's judges and judging criteria. */
export function adminProgramReviewersRoute(id: string) {
  return `${siteRoutes.adminPrograms}/${id}/reviewers`;
}

/** The applications of a program as an invited judge scores them; one opens under it. */
export function reviewProgramRoute(programId: string) {
  return `${siteRoutes.reviews}/${programId}`;
}

/** Planned pages without a screen yet; they share the coming-soon page. */
export const comingSoonPaths = ["use-cases", "use-cases/new", "get-started", "founders"] as const;

/** The product's name, as the end of a page title that is a record's own name. */
export const titleSuffix = " · BeyondPilot";

/** The address search engines and agents should know; staging and local hosts stay out of their index. */
export const siteOrigin = "https://beyondpilot.ai";

/** The live campaign runs on GenAI Fund's interim page until campaigns move onto BeyondPilot. */
export const liveCampaignUrl = "https://beyondpilot.genaifund.ai/insurance-ai-tasco";

/** Submissions to the live campaign close at 23:59 Vietnam time (ICT) on 15 October 2026. */
export const liveCampaignDeadline = "2026-10-15T23:59:00+07:00";

export const genaiFundLinks = {
  site: "https://genaifund.ai",
  about: "https://genaifund.ai/our-team/",
  events: "https://genaifund.ai/blog/",
  newsletter: "https://genaifund.ai/blog/",
  linkedin: "https://www.linkedin.com/company/genai-fund/",
  facebook: "https://www.facebook.com/profile.php?id=61558672393908",
  x: "https://twitter.com/genaifund_ai",
  email: "general@genaifund.ai",
} as const;

/** One of the signed-in person's applications. */
export function myApplicationRoute(id: string) {
  return `${siteRoutes.myApplications}/${id}`;
}
