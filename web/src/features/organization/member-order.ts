import { listSort } from "@/lib/list-sort";

import { organizationMemberSortKeys } from "./organization-members-search";

type Ordered = { accountId: string; role: string; joinedAt: string };

const text = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The members of an organization in the order `?sort=` names, for a list that holds all of them at
 * once. The order is the one the members API applies: `role` puts owners first and `joined` the
 * earliest, `-` reverses that column alone, and members that are equal stand as they joined.
 */
export function membersInOrder<M extends Ordered>(members: readonly M[], sort: string): M[] {
  const { key, desc } = listSort(sort, organizationMemberSortKeys, { key: "role", desc: false });
  const way = desc ? -1 : 1;
  const rank = (member: M) => (member.role === "owner" ? 0 : 1);
  return [...members].sort((a, b) =>
    key === "joined"
      ? way * text(a.joinedAt, b.joinedAt) || text(a.accountId, b.accountId)
      : way * (rank(a) - rank(b)) || text(a.joinedAt, b.joinedAt) || text(a.accountId, b.accountId),
  );
}
