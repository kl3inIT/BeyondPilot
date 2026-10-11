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

- Public directories (solutions, talent, use cases and programs): `DirectorySearch`, 48px. Every adjacent select and multi-select uses the shared 48px size variant, including sorting; role choices on Talent move from chips to a select containing the complete role vocabulary. Admin's denser 32px variant remains unchanged.
- Admin toolbars: the registry `input-group` at 32px, the height of the selects beside it. The introductions list, which had a 40px field and button, takes the same height.

The landing hero and the `/search` page keep their own pill-shaped field with a submit button: they start a search rather than narrow a list.

## Directories searched by meaning

Accepted on 11 October 2026 when the requester extended the scope to all four public directories. A nonblank `q` uses `/api/search` restricted to the directory's kind; an empty query keeps the existing directory browse endpoint and its default ordering. This reuses the landing search's hybrid text/title/vector ranking rather than adding another embedding service.

The alternatives were:

1. A directory module calls `search`. Refused: `search` already depends on `solution`, `talent`, `usecase` and `program` to build its index, so the edge would close a cycle that `ModulithArchitectureTest` rejects.
2. The web asks `/api/search` for the ranked items of a kind without extending its contract. Refused: industry, focus area, maturity, role, program type/phase and explicit sorting would not apply.
3. Extend the existing search contract with the directory facets and ordering. Accepted: it keeps one ranking and applies the existing filters without a reverse module dependency.

Facet and kind restrictions must be applied before the semantic candidate-pool limit. Counts and page results use the same eligibility rules, including public visibility and closed-use-case exclusion. Search defaults to relevance; an explicitly selected directory sort remains supported. Programs keep phase groups and upcoming events when browsing without a query; a query shows a paged, ranked set of program cards.

The web retains the existing domain cards and their real data, not per-result detail requests or invented defaults. Search/filter/size changes clear the page; the selected size remains available even when its result set now fits on one page. A cursor list with only a size control renders no empty pagination navigation.

Search-backed paging stays within the existing search API's 50-page window; the UI clamps an out-of-window requested page and does not generate links beyond it. Integrating the latest `main` also retains its organization filter/options on Admin Solutions alongside the selected page size.
