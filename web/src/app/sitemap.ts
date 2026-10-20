import type { MetadataRoute } from "next";

import { listSolutions, listTalent, listUseCases } from "@/lib/api/generated";
import { ownOrigin, programRoute, siteRoutes, solutionRoute, useCaseRoute } from "@/lib/site";
import { readPrograms } from "@/features/program/program-public-queries";

// The lists change as records are approved, so the sitemap is answered at request time (without
// this it is built once at `next build`, with no backend, and never lists a record). A crawler asks
// rarely, so the few list reads per request cost little.
export const dynamic = "force-dynamic";

/** The most items a list answers in one page. */
const PAGE_SIZE = 100;

/** The most pages read from one list, so a runaway total cannot hold the request. */
const MAX_PAGES = 50;

/** Pages with their own content; the coming-soon, search, sign-in, account, workspace and admin pages stay out. */
const staticPaths = [
  "",
  siteRoutes.programs,
  siteRoutes.solutions,
  siteRoutes.talent,
  siteRoutes.useCases,
  siteRoutes.howItWorks,
  siteRoutes.about,
  siteRoutes.privacy,
  siteRoutes.terms,
];

type Page<T> = { items: T[]; total: number };

/** Every item of a paginated public list; a list the backend cannot answer contributes what was read, or nothing. */
async function readAll<T>(read: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { items: batch, total } = await read(page);
      items.push(...batch);
      if (batch.length === 0 || items.length >= total) {
        break;
      }
    }
  } catch {
    // The static pages still answer when the backend does not.
  }
  return items;
}

/** One page in both languages: the English address, with the Vietnamese one as its alternate. */
function entry(
  path: string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number,
): MetadataRoute.Sitemap[number] {
  const origin = ownOrigin();
  return {
    url: `${origin}${path}`,
    changeFrequency,
    priority,
    alternates: { languages: { en: `${origin}${path}`, vi: `${origin}/vi${path}` } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const query = { cache: "no-store" } as const;
  const [programs, solutions, talent, useCases] = await Promise.all([
    readPrograms(false).catch(() => []),
    readAll(async (page) => {
      const { data } = await listSolutions({ ...query, query: { page, size: PAGE_SIZE } });
      return data;
    }),
    readAll(async (page) => {
      const { data } = await listTalent({ ...query, query: { page, size: PAGE_SIZE } });
      return data;
    }),
    readAll(async (page) => {
      const { data } = await listUseCases({ ...query, query: { page, size: PAGE_SIZE } });
      return data;
    }),
  ]);
  // There is no organizations list page; an organization is found through the solutions it lists.
  const organizations = new Set(solutions.map((solution) => solution.organizationSlug));

  return [
    ...staticPaths.map((path) =>
      entry(path, path === "" ? "weekly" : "monthly", path === "" ? 1 : 0.8),
    ),
    // A program with an external page is reached at that address, not here.
    ...programs
      .filter((program) => program.pageKind !== "external")
      .map((program) => entry(programRoute(program.slug), "weekly", 0.7)),
    ...solutions.map((solution) => entry(solutionRoute(solution.slug), "weekly", 0.6)),
    ...[...organizations].map((slug) =>
      entry(`${siteRoutes.organizations}/${slug}`, "weekly", 0.6),
    ),
    ...talent.map((profile) => entry(`${siteRoutes.talent}/${profile.slug}`, "weekly", 0.5)),
    ...useCases.map((useCase) => entry(useCaseRoute(useCase.id), "daily", 0.6)),
  ];
}
