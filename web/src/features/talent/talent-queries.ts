import { knownSort } from "@/lib/list-sort";
import { ApiError } from "@/lib/api/client";
import {
  getAdminTalent,
  getMyTalentProfile,
  getTalent,
  listAdminTalent,
  listReportedTalentEnquiries,
  listTalent,
  search as searchDirectory,
  type AdminTalent,
  type AdminTalentEnquiryList,
  type AdminTalentList,
  type MyTalent,
  type PublicTalent,
  type PublicTalentList,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";
import { maxSearchPage } from "@/lib/page-size";

import type { AdminTalentSearch, TalentSearch } from "./talent-search";
import { adminTalentSortKeys } from "./talent-search";

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
export async function readTalent(search: TalentSearch): Promise<PublicTalentList> {
  const q = text(search.q);
  if (q) {
    const { data } = await searchDirectory({
      cache: "no-store",
      query: {
        q,
        kind: "talent",
        role: search.role ?? undefined,
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
        headline: item.subtitle,
        city: item.city,
        country: item.country,
        photoFileId: item.photoFileId,
        roles: item.roles,
        skills: item.skills,
        featured: item.featured!,
        projectCount: item.projectCount!,
        leadProject: item.leadProjectTitle
          ? {
              title: item.leadProjectTitle,
              stage: (item.leadProjectStage ?? undefined) as NonNullable<
                PublicTalentList["items"][number]["leadProject"]
              >["stage"],
            }
          : null,
      })),
    };
  }
  const { data } = await listTalent({
    cache: "no-store",
    query: {
      q: text(search.q),
      role: search.role ?? undefined,
      sort: search.sort ?? "newest",
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
    },
  });
  return data;
}

/**
 * One profile of the directory by its address, or `null`. Read as the person behind this request,
 * so it says when their message to the profile still waits. Server only.
 */
export async function readTalentProfile(slug: string): Promise<PublicTalent | null> {
  try {
    const { data } = await getTalent({ ...(await sessionRequest()), path: { slug } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** The caller's own profile and the messages sent through it. Server only. */
export async function readMyTalent(): Promise<MyTalent> {
  const { data } = await getMyTalentProfile(await sessionRequest());
  return data;
}

/** One page of submitted profiles for the operator behind this request. Server only. */
export async function readAdminTalentList(search: AdminTalentSearch): Promise<AdminTalentList> {
  const { data } = await listAdminTalent({
    ...(await sessionRequest()),
    query: {
      q: text(search.q),
      status: search.status ?? undefined,
      featured: search.featured === null ? undefined : search.featured === "true",
      sort: knownSort(search.sort, adminTalentSortKeys),
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
    },
  });
  return data;
}

/** One page of the messages people reported, for the operator behind this request. Server only. */
export async function readReportedTalentEnquiries(
  page: number,
  size: number | null,
): Promise<AdminTalentEnquiryList> {
  const { data } = await listReportedTalentEnquiries({
    ...(await sessionRequest()),
    query: { page: Math.max(1, page), size: size ?? undefined },
  });
  return data;
}

/** One submitted profile as an operator reviews it, or `null`. Server only. */
export async function readAdminTalent(id: string): Promise<AdminTalent | null> {
  try {
    const { data } = await getAdminTalent({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}
