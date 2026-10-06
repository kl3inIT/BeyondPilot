# Solution demo and deck links, and approved-but-unlisted solutions

Tracked in Linear as BEY-34. Source: the client brief, [section 7.5](../../../brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md) and its acceptance table.

## What changes

1. **Demo and deck.** The brief lists "demo/deck" among what a solution shows. A solution gains two optional links, `demoUrl` (a video or a live demo) and `deckUrl` (a presentation). Both are `http(s)` addresses, shown on the public page and written in the owner's editor. Neither is required to submit: early-stage providers must not be blocked ([brief 7.5](../../../brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md)).
2. **Approved but unlisted.** `listed = false` on an approved solution no longer answers `404`. The public page opens for anyone who has its address, the directory and the organization page leave it out, and the page asks search engines not to index it. A draft, a submitted or a rejected solution still answers `404`, so an address does not reveal that one exists.
3. **Introductions follow approval.** A request for an introduction needs an approved solution, listed or not, because an unlisted solution is meant to be shared by link.

## Decisions

- **Links, not uploads.** A deck file would add a dependency from `solution` to `storage` and a new file purpose with its own review of what may be read publicly. Links carry the same information for the directory, add no module edge and can be replaced by an upload later without changing the page. Revisit when the client asks for hosted files.
- **The link policy is the address.** The brief leaves the link-access policy to be agreed. Until it is, anyone with the slug reads the page. The slug derives from the name, so an unlisted solution is not secret, only absent from discovery.
- **No separate matching flag.** The brief asks that approval, visibility and matching eligibility not be one state. Approval is `status` and visibility is `listed`; matching does not exist yet, and a column no code reads would be speculative. When matching is built it selects on `status = 'approved'` and ignores `listed`.

## Known limits

- A change to an approved solution still shows at once, with no snapshot of what was approved. That is a separate piece of work.
- The links are not checked for reachability or content; operators see them when they review.
