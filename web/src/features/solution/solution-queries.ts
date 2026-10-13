import { knownSort } from "@/lib/list-sort";
import { ApiError } from "@/lib/api/client";
import {
  getAdminOffer,
  getAdminSolution,
  getAdminSolutionDraft,
  getMySolution,
  getOrganization,
  getSharedSolution,
  getSolution,
  listAdminOffers,
  listAdminSolutions,
  listCustomerDeployments,
  listMySolutions,
  listOwnOffers,
  listSolutions,
  search as searchDirectory,
  type AdminOffer,
  type AdminOfferDetail,
  type AdminSolutionList,
  type MySolutions,
  type OwnOffer,
  type PublicCustomerDeploymentList,
  type PublicOrganization,
  type PublicSolution,
  type PublicSolutionList,
  type Solution,
  getDeploymentReviewQueue,
  getSolutionReviewQueue,
  type SolutionReviewQueue,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";
import { maxSearchPage } from "@/lib/page-size";

import type { AdminSolutionsSearch, SolutionsSearch } from "./solutions-search";
import { adminSolutionSortKeys } from "./solutions-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

const text = (q: string) => q.trim().slice(0, MAX_SEARCH) || undefined;

/** Nothing, in place of a record the backend does not have or an identifier it cannot read. */
function absent(error: unknown): null {
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return null;
  }
  throw error;
}

/** One page of the public directory. Read without a session and never kept: approval shows at once. */
export async function readSolutions(search: SolutionsSearch): Promise<PublicSolutionList> {
  const q = text(search.q);
  if (q) {
    const { data } = await searchDirectory({
      cache: "no-store",
      query: {
        q,
        kind: "solution",
        industry: search.industry ? [search.industry] : undefined,
        focusArea: search.focusArea ?? undefined,
        maturity: search.maturity ?? undefined,
        sort: search.sort ?? undefined,
        page: Math.min(maxSearchPage, Math.max(1, search.page)),
        size: search.size ?? undefined,
      },
    });
    return {
      ...data,
      items: data.items.map((item) => ({
        name: item.title,
        slug: item.slug,
        summary: item.summary,
        organizationName: item.subtitle!,
        organizationSlug: item.organizationSlug!,
        industries: item.industries,
        focusAreas: item.focusAreas,
        maturity: item.maturity as PublicSolutionList["items"][number]["maturity"],
        country: item.country,
        logoFileId: item.photoFileId,
        coverFileId: item.coverFileId,
        customerDeployments: item.customerDeployments!,
        featured: item.featured!,
        backing: item.backing,
        offers: item.offers,
      })),
    };
  }
  const { data } = await listSolutions({
    cache: "no-store",
    query: {
      q: text(search.q),
      industry: search.industry ?? undefined,
      focusArea: search.focusArea ?? undefined,
      maturity: search.maturity ?? undefined,
      sort: search.sort ?? "newest",
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
    },
  });
  return data;
}

/** One solution of the directory by its address, or `null`. */
export async function readSolution(slug: string): Promise<PublicSolution | null> {
  try {
    const { data } = await getSolution({ cache: "no-store", path: { slug } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** A solution by the key of its shared page, whatever its review says, or `null`. Read without a session. */
export async function readSharedSolution(viewKey: string): Promise<PublicSolution | null> {
  try {
    const { data } = await getSharedSolution({ cache: "no-store", path: { viewKey } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** The public page of an approved organization by its address, or `null`. */
export async function readCompany(slug: string): Promise<PublicOrganization | null> {
  try {
    const { data } = await getOrganization({ cache: "no-store", path: { slug } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** How many solutions a company's page shows before any more are asked for. */
const COMPANY_PREVIEW = 4;

/** The most directory pages a company's page loads; past it the directory is the place to look. */
export const MAX_COMPANY_PAGES = 10;

export type CompanySolutions = Pick<PublicSolutionList, "items" | "total">;

/**
 * The solutions an organization lists, the newest first: a preview until more are asked for, then
 * that many pages of the directory read together.
 */
export async function readCompanySolutions(slug: string, more: number): Promise<CompanySolutions> {
  const pages = Math.min(Math.max(1, more), MAX_COMPANY_PAGES);
  const lists = await Promise.all(
    Array.from({ length: pages }, async (_, index) => {
      const { data } = await listSolutions({
        cache: "no-store",
        query: { organization: slug, sort: "newest", page: index + 1 },
      });
      return data;
    }),
  );
  const items = lists.flatMap((list) => list.items);

  return { items: more > 0 ? items : items.slice(0, COMPANY_PREVIEW), total: lists[0].total };
}

/** The first page of the approved customer deployments of an organization's solutions. */
export async function readCompanyDeployments(slug: string): Promise<PublicCustomerDeploymentList> {
  const { data } = await listCustomerDeployments({
    cache: "no-store",
    query: { organization: slug },
  });
  return data;
}

/** The solutions of the caller's organization. Server only. */
export async function readMySolutions(): Promise<MySolutions> {
  const { data } = await listMySolutions(await sessionRequest());
  return data;
}

/** The offers the caller's organization wrote for its solutions. Server only. */
export async function readMyOffers(): Promise<OwnOffer[]> {
  const { data } = await listOwnOffers(await sessionRequest());
  return data;
}

/** One solution of the caller's organization, or `null`. Server only. */
export async function readMySolution(id: string): Promise<Solution | null> {
  try {
    const { data } = await getMySolution({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** One page of submitted solutions for the operator behind this request. Server only. */
export async function readAdminSolutions(search: AdminSolutionsSearch): Promise<AdminSolutionList> {
  const { data } = await listAdminSolutions({
    ...(await sessionRequest()),
    query: {
      q: text(search.q),
      organizationId: search.organizationId ?? undefined,
      status: search.status ?? undefined,
      industry: search.industry ?? undefined,
      featured: search.featured === null ? undefined : search.featured === "true",
      sort: knownSort(search.sort, adminSolutionSortKeys),
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
    },
  });
  return data;
}

/** One submitted solution as an operator reviews it, or `null`. Server only. */
export async function readAdminSolution(id: string): Promise<Solution | null> {
  try {
    const { data } = await getAdminSolution({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** The list of offers GenAI Fund keeps, for the operator behind this request. Server only. */
export async function readAdminOffers(): Promise<AdminOffer[]> {
  const { data } = await listAdminOffers(await sessionRequest());
  return data;
}

/** One offer with the solutions that come with it, or `null` when there is no such offer. Server only. */
export async function readAdminOffer(id: string): Promise<AdminOfferDetail | null> {
  try {
    const { data } = await getAdminOffer({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** One draft as an operator's editor reads it, or `null`. Server only. */
export async function readAdminSolutionDraft(id: string): Promise<Solution | null> {
  try {
    const { data } = await getAdminSolutionDraft({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** How many solutions wait for review now, and each of the last 14 days. Server only. */
export async function readSolutionQueue(): Promise<SolutionReviewQueue> {
  const { data } = await getSolutionReviewQueue(await sessionRequest());
  return data;
}

/** How many customer deployments wait for review now, and each of the last 14 days. Server only. */
export async function readDeploymentQueue(): Promise<SolutionReviewQueue> {
  const { data } = await getDeploymentReviewQueue(await sessionRequest());
  return data;
}
