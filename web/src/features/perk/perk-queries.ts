import { ApiError } from "@/lib/api/client";
import {
  getAdminPerk,
  getAdminPerkOptions,
  getMyPerk,
  getMyPerkOptions,
  getPerk,
  listAdminPerkClaims,
  listAdminPerks,
  listMyPerkClaims,
  listMyPerks,
  listPerks,
  listProgramPerks,
  listSolutionPerks,
  listTeamClaims,
  type OwnPerk,
  type Perk,
  type PerkCard,
  type PerkClaimRow,
  type PerkOptions,
  type PerkPage,
  type SolutionPerkLine,
  type TeamClaim,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** Nothing, in place of a record the backend does not have or an identifier it cannot read. */
function absent(error: unknown): null {
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return null;
  }
  throw error;
}

/**
 * The catalogue. A visitor reads it too; the caller's session is sent so each card says whether their
 * team may get the perk. Server only.
 */
export async function readPerks(ended: boolean): Promise<PerkCard[]> {
  const { data } = await listPerks({ ...(await sessionRequest()), query: { ended } });
  return data;
}

/** A perk's page and what the caller's team holds of it, or `null`. Server only. */
export async function readPerk(slug: string): Promise<PerkPage | null> {
  try {
    const { data } = await getPerk({ ...(await sessionRequest()), path: { slug } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/**
 * The perks a program's page shows. A read that fails leaves the page without its perks rather than
 * without the program. Server only.
 */
export async function readProgramPerks(slug: string): Promise<PerkCard[]> {
  try {
    const { data } = await listProgramPerks({ ...(await sessionRequest()), path: { slug } });
    return data;
  } catch {
    return [];
  }
}

/**
 * The open perks of the solutions at these addresses, by address, for their cards. A read that fails
 * leaves the cards without perks rather than the directory without solutions. Server only.
 */
export async function readSolutionPerks(
  slugs: string[],
): Promise<Record<string, SolutionPerkLine[]>> {
  if (slugs.length === 0) {
    return {};
  }
  try {
    const { data } = await listSolutionPerks({ cache: "no-store", query: { slugs } });
    return Object.fromEntries(data.map((solution) => [solution.slug, solution.perks]));
  } catch {
    return {};
  }
}

/** The perks anyone in the caller's organization got. Server only. */
export async function readTeamClaims(): Promise<TeamClaim[]> {
  const { data } = await listTeamClaims(await sessionRequest());
  return data;
}

/** The perks the caller's organization gives. Server only. */
export async function readMyPerks(): Promise<OwnPerk[]> {
  const { data } = await listMyPerks(await sessionRequest());
  return data;
}

/** A perk of the caller's organization as its form reads it, or `null`. Server only. */
export async function readMyPerk(id: string): Promise<Perk | null> {
  try {
    const { data } = await getMyPerk({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** Who got a perk of the caller's organization. Server only. */
export async function readMyPerkClaims(id: string): Promise<PerkClaimRow[]> {
  const { data } = await listMyPerkClaims({ ...(await sessionRequest()), path: { id } });
  return data;
}

/** The caller's organization's solutions and the programs a perk's form chooses from. Server only. */
export async function readMyPerkOptions(): Promise<PerkOptions> {
  const { data } = await getMyPerkOptions(await sessionRequest());
  return data;
}

/** Every perk, for the operator behind this request. Server only. */
export async function readAdminPerks(): Promise<OwnPerk[]> {
  const { data } = await listAdminPerks(await sessionRequest());
  return data;
}

/** One perk as an operator's form reads it, or `null`. Server only. */
export async function readAdminPerk(id: string): Promise<Perk | null> {
  try {
    const { data } = await getAdminPerk({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** Who got a perk, for an operator. Server only. */
export async function readAdminPerkClaims(id: string): Promise<PerkClaimRow[]> {
  const { data } = await listAdminPerkClaims({ ...(await sessionRequest()), path: { id } });
  return data;
}

/** An organization's solutions and the programs, for an operator's perk form. Server only. */
export async function readAdminPerkOptions(organizationId: string): Promise<PerkOptions> {
  const { data } = await getAdminPerkOptions({
    ...(await sessionRequest()),
    query: { organizationId },
  });
  return data;
}
