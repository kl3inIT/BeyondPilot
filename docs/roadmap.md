# BeyondPilot roadmap

## Delivered

- [BEY-68 — Email that operators run](increments/completed/bey-68-email-delivery/design.md), 6 October 2026: email through Amazon SES, Resend or SMTP, chosen and set up by operators in Admin › Email with their secrets sealed; twenty-four kinds of email worded as English templates operators can edit with a live preview; a queue and log with retries, delivery reports and suppressed addresses; a setup checklist that asks the provider about the domain and its DNS records. Staging sends from `beyondpilot.vadan.app`; production waits on the DNS of `beyondpilot.ai`.
- [BEY-72 — AI providers and the search index in Admin](increments/completed/bey-72-ai-providers/design.md), 6 October 2026: operators connect the embedding provider and choose its model in Admin › AI, its key sealed in the database, and follow the search index: what is embedded, what the provider refused, and semantic search on or off.
- [BEY-65 — Search](increments/completed/bey-65-search/design.md), 6 October 2026: one index over programs, use cases, AI solutions and AI talent behind `/search`, ranked by words and, with embeddings, by meaning (BEY-69, BEY-70); a tab per kind, each with its count.
- [BEY-38 — Reviewing applications and releasing outcomes](increments/completed/bey-38-review/design.md), 6 October 2026: a program's judging criteria, judges invited by email who score the applications, GenAI Fund's decisions kept private until it releases them, and every applicant told on the same day.
- [BEY-37 — Applying to a program](increments/completed/bey-37-proposal/design.md), 6 October 2026: sign in and return to the form, a four-step application saved as a draft, submission with its receipt, My applications, and changes or withdrawal while the window is open.
- [BEY-29 — Programs](increments/completed/bey-29-program/design.md), 6 October 2026: operators create, edit, publish and unpublish programs with their window, key dates, events and cover, each change audited; the public list by phase and type, the standard program page and the page made for the AI for Insurance Challenge. The 2026 programs are entered on production.
- [BEY-49 — Admin: the audit log](increments/completed/bey-49-admin-audit-log/design.md), 5 October 2026: the operators' reading of the audit record at `/admin/audit-log`, narrowed by period, action and a search, and walked by cursor.
- [BEY-30 — Identity](increments/completed/bey-30-identity/design.md), 4 October 2026: sign-in with Google and with an emailed six-digit code that returns a person where they were, sessions, the operator role, and the signed-in header.
- [BEY-48 — Admin: accounts](increments/completed/bey-48-admin-accounts/design.md), 4 October 2026: the operators' list of everyone who has signed in, granting and withdrawing the operator role, disabling and enabling an account, and the audit record of each change.

## Active

- [BEY-92 — AI models](increments/active/bey-92-ai-models/design.md): a new `ai` module where operators connect chat providers (OpenAI, Claude, 9Router, OpenRouter, any OpenAI-compatible endpoint), choose the model each task uses, and every call is recorded with its tokens. Matching (BEY-39) is the first task. Proposed; the screens are not drawn yet.
- [BEY-66 — The operators' review of solutions](increments/active/bey-66-admin-solution-review/design.md): the queue finds by organization, narrows by industry, names who sent each solution and says how many wait; the record reads as labelled rows with the decision in view. Backend verified; the web screens are checked by CI and still to be walked in the browser.
- [BEY-33 — Organizations, the solution catalog and talent profiles](increments/active/bey-33-organization-solution-talent/design.md): organizations and membership, solutions and talent profiles with their review by operators, and the public directories. Built and walked in the browser; the backend tests are still to run.
- [BEY-22 — Phase 1 domain model](increments/active/bey-22-phase-1-domain-model/design.md): accounts and organizations, the solution catalog, talent, use cases, programs, proposals, matching and the migration from the old platform. Draft for review.
- [BEY-32 — Storage](increments/active/bey-32-storage/design.md): files kept and served through an adapter, the local disk now and S3 later, with the web upload helper. Done except the cleanup of uploads whose ticket expired.
- [BEY-27 — Main flows as UI design](increments/active/bey-27-main-flows-design/design.md): the program pages, the application flow and the directory drawn in Figma for the 6 October milestone. Closed in Linear; the pill shape of the Figma `Button` and the prototype wiring are still marked in progress in its plan.

## Candidates
