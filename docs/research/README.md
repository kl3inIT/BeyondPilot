# Research

What the team studied before designing BeyondPilot, kept so that a later reader can see what a decision was based on. Each note is dated and names its sources. A note records what was found; the decisions that follow from it live in the product context ([PRODUCT.md](../../PRODUCT.md), [vision](../vision.md)), the design system ([DESIGN.md](../../DESIGN.md)) and the increments.

| Note                                                                                               | Covers                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Existing products](2026-10-02-existing-products.md)                                               | The platform BeyondPilot replaces, GenAI Fund's prototype of the new product and the interim application app: what each does and what it teaches                                                         |
| [Flows and references](2026-10-02-flows-and-references.md)                                         | A reference and a proposal for each Phase 1 flow: directory, solution and talent pages, program pages, sign-in, application, review and shortlist                                                        |
| [Programs and events](2026-10-02-programs-and-events.md)                                           | The 21 programs and 56 events GenAI Fund has run, with their sources                                                                                                                                     |
| [Landing page](2026-10-03-landing.md)                                                              | The structures considered for the home page, the design critiques and where every image on it comes from                                                                                                 |
| [Admin: the Accounts screen](2026-10-04-admin-accounts.md)                                         | How other products list people with a role and a status, confirm switching an account off, and mark one's own row; what the Accounts screen took from them                                               |
| [Admin: the Audit log screen](2026-10-05-admin-audit-log.md)                                       | How other products list who changed what, filter it by period and action, open one event and page a log that only grows; what the Audit log screen took from them                                        |
| [What Payload teaches an App Router application](2026-10-04-payload-lessons.md)                    | What was read in Payload, the one reference built on the App Router: what was adopted, what waits for later increments, and what does not transfer to an application whose data is behind a separate API |
| [Campaign pages and main-flow patterns](../increments/active/bey-27-main-flows-design/research.md) | Real campaign sites and the patterns behind the program page, the application flow and the directory                                                                                                     |

## Data

| File                                                                                                 | Holds                                                                                           | Source                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [data/programs-and-events.json](data/programs-and-events.json)                                       | 21 programs with type, partners, countries, dates, status, and their Luma events and blog posts | genaifund.ai/blog and GenAI Fund's Luma calendars, read on 2 October 2026 |
| [data/use-cases-open-innovation-vietnam-2025.json](data/use-cases-open-innovation-vietnam-2025.json) | 41 enterprise use cases in seven industries, each with what the enterprise needs                | genaifund.ai/genai-open-innovation-vietnam-2025, read on 3 October 2026   |

## Sources, kept as received

| File                                                                                 | Holds                                                                                                                              |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [sources/2026-10-02-kickoff-transcript.md](sources/2026-10-02-kickoff-transcript.md) | The automatic transcript of the kickoff with GenAI Fund, in Vietnamese and English, with one exchange about a test account removed |
| [sources/use-case-solution-research.md](sources/use-case-solution-research.md)       | The skill GenAI Fund's project lead uses to research vendors for a use case: the three relevance buckets and the evidence rules    |
| [sources/2026-10-03-landing-critique.md](sources/2026-10-03-landing-critique.md)     | The second design critique of the landing page, as scored                                                                          |
| [data/landing-image-sources.json](data/landing-image-sources.json)                   | Where each image on the landing page comes from, and the candidates that were not used                                             |

## Captures

| Folder                                           | Holds                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [captures/old-platform/](captures/old-platform/) | Screens of app.genaifund.ai as seen with the view-only test account, each as an image and as the text of its headings, labels and fields: public home, use case form, an enterprise's use cases and matches, startup registration and profile, notifications, and the administration area |
| [captures/prototype/](captures/prototype/)       | Screens of GenAI Fund's prototype of BeyondPilot; its sample solutions and people are fictional                                                                                                                                                                                           |

## Rules for this folder

- **Credentials are never recorded**: no account name with its password, no token, no key. A source that contains one is stored with that part removed and the removal marked.
- A source is kept as received, in its own language, apart from that. Notes are written in English.
- Names and messages of people outside the team and GenAI Fund are removed from captures of private conversations.
- Screenshots of third-party products studied as references are not committed; a note links to the page instead.
- A note is not edited to match later decisions. When a finding is superseded, the newer note says so.
