# ADR 0008: A `messaging` module carries the conversations of talent, solutions and programs

- Status: Accepted, implementation started 2026-10-13
- Date: 2026-10-13
- Decision owner: BeyondPilot team

## Context

BeyondPilot let a person reach someone in one way: an enquiry through a talent profile, kept by `talent` ([BEY-36](../increments/active/bey-36-talent-enquiries-and-review/design.md)), which ended in an exchange of email addresses. A request for an introduction to a solution's provider ([BEY-34](../increments/active/bey-34-solution-introductions/design.md)) had worked the same way in a module of its own, with its request, its answer, its emails and its screens written a second time; BEY-172 removed it on the day of this decision, unused.

On 13 October 2026 the team was asked for a chat on the platform itself, as the old platform's `/threads` had, but live, with solution providers, with AI talent and with GenAI Fund about its programs ([research](../research/2026-10-13-messaging-references.md)).

The domain story, glossary, data owners and context map are in the [BEY-173 design](../increments/active/bey-173-messaging/design.md), as [boundary discovery](../conventions.md#boundary-discovery) asks.

## Decision

- **A module `messaging` owns conversations, their messages and how far each reader read.** It depends on `talent`, `solution` and `program` for what a conversation is about, on `organization` and `identity` for who is on each side, and on `notification` and `audit`; nothing depends on it.
- **It replaces the enquiry flow.** The enquiry code leaves `talent`, and its rows become conversations in one migration.
- **Events reach open screens as server-sent events**, told through one sink inside the instance after the transaction commits, as `matching` does. A message is written by an ordinary POST under an identifier the screen chooses.
- **One method is added to a module other people own**: `TalentDirectory.recipient(slug)`, the account behind a listed profile, which the public page never gives.

## Alternatives considered

- **Keep the enquiry in `talent` and add conversations beside it for solutions.** The request, answer, read and limit rules are the same for every subject; two homes would keep them written twice and make a program's conversations a third.
- **Bring back the `introduction` module and extend it to carry talent.** Its name and its tables were about one answer that shares two addresses; nothing of it would have been left but the package.
- **A WebSocket, with STOMP or a handler of our own.** Only the server pushes here, and the proxy, the session cookie and the browser's reconnection already work for server-sent events in this application. A second transport would bring its own authentication, proxy configuration and tests for no behaviour a reader would notice.
- **A message broker or an event journal for delivery.** One instance runs; a screen that was away reads what it missed by one request. The limit is recorded, as it is for matching.

## Consequences

- With more than one instance, an event reaches only the screens connected to the instance that wrote it. Going beyond one instance needs a channel between them (PostgreSQL `LISTEN/NOTIFY` is the nearest), for `matching` and `messaging` alike.
- A conversation holds personal text. It is read by its two sides only; operators read a first message only when it was reported.
- `talent` no longer depends on `organization`, which only its enquiries needed; it keeps `notification` for the emails of a review.
