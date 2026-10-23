# ADR 0011: `program` reads Luma through its API, keeps the key an operator gives, and emails the people who register

- Status: Accepted, implementation started 2026-10-23
- Date: 2026-10-23
- Decision owner: BeyondPilot team

## Context

BEY-190 brought the events of the GenAI Fund calendar on Luma onto the site from the calendar's public iCal feed and each event page's JSON-LD, with no key, because GenAI Fund had no Luma Plus. Its design said that once it had, "the two reads become one API call and nothing else changes".

On 23 October 2026 GenAI Fund asked that people register for its events on BeyondPilot, become users as they do, and be told when they are approved or declined ([BEY-245](https://linear.app/beyondpilot/issue/BEY-245); [design](../increments/active/bey-245-luma-registration/design.md), [research](../research/2026-10-23-luma-registration.md)). It has Luma Plus and made BeyondPilot an admin of the calendar. Only the API gives an event's registration questions, adds a guest and tells of a decision; the feed and the page give none of these.

A registration is a guest of a Luma event: Luma holds the decision, GenAI Fund makes it there, and BeyondPilot keeps what the person sent and tells them the outcome. That is not an application judged by reviewers, which `proposal` owns.

## Decision

- **`program` reads the calendar through Luma's API and its webhooks**, and the iCal feed and the JSON-LD reads go. One source, not two modes.
- **The API key and the webhook's signing secret are configuration an operator keeps in Admin**, sealed with AES-256-GCM under `beyondpilot.program.luma.encryption-key` (`BEYONDPILOT_PROGRAM_ENCRYPTION_KEY`) and never returned, as ADR 0005 and ADR 0006 keep the email and AI providers' secrets. Saving the key checks it, finds its calendar and makes the webhook; nothing about Luma is configured on a host but the encryption key.
- **A registration belongs to `program`** (`program.luma`): the form built from the event's questions, the send to Luma, the status Luma decides.
- **`program` depends on `notification`** to send the person the emails about their registration through `EmailService`, as `proposal` does for applications. `notification` depends on no module that depends on `program`, so the edge makes no cycle. It is added with the first email, in the second slice of BEY-245.

## Alternatives considered

- **Keep the feed for the calendar and use the API only to register.** Two reads of the same events, one of which lacks the questions and the time zone.
- **The key in a host secret file.** An operator could not replace or remove it, and a key given by a client would travel through someone to reach the host.
- **Registrations in `proposal`.** Its applications are judged by reviewers on BeyondPilot and follow the program's window; a guest is decided on Luma. `proposal` would also call Luma through `program`.
- **Let Luma email the person.** GenAI Fund's brief asks BeyondPilot to send them; Luma's check-in address and an .ics keep what Luma's email gave.

## Consequences

- A new dependency edge, `program` → `notification`, recorded in `ModulithArchitectureTest` and `ARCHITECTURE.md` when it is added.
- Each environment needs `program-encryption-key` among its secrets; until an operator pastes a key, its events are not read.
- ical4j and jsoup leave the backend's dependencies.
