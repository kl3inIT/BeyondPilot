# Published use cases remain readable after proposals close

## Accepted scope

A visitor can discover and read an approved, published enterprise problem after its proposal deadline. Closing proposals is not unpublishing the brief or declaring the project completed. Draft, in-review and needs-changes records remain private. Existing organization visibility, anonymity and members-only budget rules remain in force.

The public directory and search include open and closed published use cases, with a proposal-status filter (all by default, open or closed). Directory ordering puts open cases first, then applies the selected order; featured cases lead only within their availability group in the opening view. Search relevance remains relevance; explicit directory orders put open cases first. Counts and page queries use the same filter before limiting. Existing URL-based pagination, page sizes and page-one resets are reused.

Cards and the proposal panel show the concise status Closed / Đã đóng in the neutral status tone; open cases retain their success tone. Closed deadlines use past-tense wording. On list cards, availability belongs with the deadline and View use case in the action column, not with the industry. On phones it follows the budget/timeline facts and precedes the deadline/action row.

The accepted Figma review is `Screens` → `Use cases` → `Use cases — Proposal availability · Review 16 Oct` (`787:59151`), with 1440/1024/390 layouts. The proposal panel keeps its status/date header and full-width action footprint: a disabled danger button labeled Proposals closed / Đã hết hạn nộp replaces sending, without the former explanatory paragraph. It remains full-opacity for legibility rather than looking like an actionable link. Existing sent-proposal and received-proposal links take precedence over that fallback. The comparison and layout reuse BeyondPilot's Status/Button and semantic tokens; the Mobbin reference was [Meetup's canceled event detail](https://mobbin.com/screens/dccd343c-294d-4a2d-a001-5d326cf4b01d), which retains readable content after registration stops, not a reference for the requested red button itself.

Submission, resubmission, withdrawal and editing guards are unchanged. Existing senders still read their sent proposals and posting organizations still review received proposals. The visual revision adds no browser data state or new query/cache lifecycle; the existing server reads, URL controls and TanStack ownership remain unchanged.

## Implementation boundary

Keep review approval separate from deadline-derived availability. Do not loosen the published-status predicate, rewrite stored lifecycle statuses, add a migration or introduce a background expiry task. Extend the existing usecase and search read models, generated contract, directory controls and shared Status presentation. Tests cover mixed-status pagination, detail reads, search eligibility and filters, and closed proposal actions.

Linear could not be refreshed at implementation start because the connected app requires reauthentication. No issue was created in an unrelated workspace.
