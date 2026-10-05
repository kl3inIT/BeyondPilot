/** Site-wide destinations. Routes without a page yet render the shared coming-soon page. */
export const siteRoutes = {
  home: "/",
  programs: "/programs",
  useCases: "/use-cases",
  solutions: "/solutions",
  talent: "/talent",
  signIn: "/sign-in",
  getStarted: "/get-started",
  publishUseCase: "/use-cases/new",
  talentProfile: "/talent/new",
  founders: "/founders",
  search: "/search",
  admin: "/admin",
  adminPrograms: "/admin/programs",
  adminAccounts: "/admin/accounts",
  adminAuditLog: "/admin/audit-log",
} as const;

/** The host the public site is served from, as an operator sees a program's address written out. */
export const publicSiteHost = "beyondpilot.genaifund.ai";

/** A program's Settings in the admin area, the screen a program opens on. */
export function adminProgramRoute(id: string) {
  return `${siteRoutes.adminPrograms}/${id}/settings`;
}

/** Planned pages without a screen yet; they share the coming-soon page. */
export const comingSoonPaths = [
  "programs",
  "use-cases",
  "use-cases/new",
  "solutions",
  "talent",
  "talent/new",
  "get-started",
  "founders",
  "search",
] as const;

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
