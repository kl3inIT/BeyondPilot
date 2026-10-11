# BEY-136 — Lists: page size, a country filter for operators, one search field per surface

Status: in progress ([plan](plan.md)). Asked for on 11 October 2026 while reviewing the local build. It changes the list contract every module shares, so it is one increment across them rather than a change inside one.

## Domain story

A person reading a list chooses how much of it a page holds. An operator going through organizations narrows them to one country. A person searching a public directory meets the same field on every directory.

_Failures:_ the address carries a size the API would refuse (the web reads it as absent, the API answers `400` to a direct call); a size is chosen on a late page (the list returns to its start, because the page number no longer names the same records).

## Page size

Every paged list request takes an optional `size`.

| Query parameter | Values                             | Meaning                     |
| --------------- | ---------------------------------- | --------------------------- |
| `size`          | 1 to 100; the list's own if absent | How many items a page holds |

- The answer's `pageSize` is the size used, so the web draws its control from the response.
- The list's own size stays what it was (10, 12, 20, 25 or 50); nothing changes for a caller that sends no `size`.
- One bound, 100, for every list: it keeps the widest table readable and the heaviest query bounded. The API takes any whole number up to it; which sizes are offered is the web's choice.
- The two logs paged by cursor (`listAuditEvents`, `listEmailMessages`) take `size` as well. A cursor names a place, not a page, so it stays valid when the size changes; the web still returns to the newest end.
- `search` takes `size` for one kind's tab. The All tab keeps its three of each kind.

In the web the size is the URL, as the search and the filters are (`?size=`). `PageSizeSelect` writes it and clears `page`, `before` and `after`. A table offers 10, 25, 50 and 100; a directory of cards offers 12, 24 and 48, which fill whole rows at two, three and four columns. The control appears once the list holds more than its smallest page, and stays when the chosen size fits everything on one page, so the choice can be undone.

The Members tab of one organization in admin pages what the page already holds; it reads the same `size` and slices by it.

## Country filter

`GET /api/organization/admin/organizations` (`listAdminOrganizations`) takes `country`, an ISO 3166-1 alpha-2 code, and answers `countries`: the countries organizations that are not merged are in, in order. The filter offers only those, named in the reader's language, so an operator never picks a country that selects nothing.

Only organizations carry a country an operator filters by today. A solution and a use case have none of their own (theirs is their organization's, which is another module's fact), and the talent list in admin does not show one. A filter there is a later change with its own reason.

## Search fields

One field per surface, not one for the whole product: a public directory and an admin toolbar are read at different densities.

- Public directories (solutions, talent, use cases): `DirectorySearch`, 48px. The use case list moves to it from the admin-sized field, and the solutions list drops its 44px override.
- Admin toolbars: the registry `input-group` at 32px, the height of the selects beside it. The introductions list, which had a 40px field and button, takes the same height.

The landing hero and the `/search` page keep their own pill-shaped field with a submit button: they start a search rather than narrow a list.

## Not in this increment: directories searched by meaning

Asked for, and not built here. The directories match `q` against names with `like`; `/api/search` ranks by words and by meaning. Three ways to bring the second into the first:

1. A directory module calls `search`. Refused: `search` already depends on `solution`, `talent`, `usecase` and `program` to build its index, so the edge would close a cycle that `ModulithArchitectureTest` rejects.
2. The web asks `/api/search` for the ranked items of a kind and draws those. It needs no new edge, but the directory's own filters (industry, focus area, maturity, role, sort) would not apply to what is drawn.
3. `search` learns the directory's filters: its index already stores each card's facets, so `/api/search` can take them as parameters and the directory pages read from it whenever `q` is present. This keeps one ranking and the filters, at the cost of the filter vocabulary living in two modules.

Option 3 is the recommendation. It changes which module answers a directory page and so needs an accepted decision before code.
