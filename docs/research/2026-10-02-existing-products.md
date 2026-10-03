# Existing products

Reviewed on 2 October 2026: the platform BeyondPilot replaces, GenAI Fund's own prototype of the new product, and the interim application for the AI for Insurance Challenge. The old platform was read with a view-only test account that GenAI Fund provided; nothing was created or submitted. The raw captures are in [captures/old-platform](captures/old-platform/) and [captures/prototype](captures/prototype/). All three are references. BeyondPilot's flows, statuses and data model are the team's to define.

## What GenAI Fund asked for at the kickoff

The kickoff was held on 2 October 2026 with Laura Nguyen, the partner at GenAI Fund who sent the brief and coordinates, and Kai Yong Kang, who leads the project there. The [transcript](sources/2026-10-02-kickoff-transcript.md) is kept as received.

- 6 October 2026: the main flows as UI, for feedback. 9 October: the site live with listings of solutions, use cases, talent and programs, and applications arriving in the solutions database instead of the interim app. Before 16 October: AI matching.
- The old data is migrated in Phase 1, but its fields are not copied as they are: keyword matching on them was right about 30% of the time, in Laura's estimate.
- Providers must be able to update their own data.
- Candidates for a use case come from the database, from research and from open applications. An operator must also be able to add a provider by hand and to remove a wrong match; the old platform allows neither.
- Sign-in by email link today; Google sign-in is wanted as well.
- Programs and events come from public sources: the blog and the Luma calendars.

## The old platform (app.genaifund.ai)

**Public home.** 208 use cases with search and a filter of 22 industries. Use cases carry program tags (Nestlé Vietnam AI Reinvention, Shinhan Innoboost 2026, Tasco Innovation Day, GenAI Open Innovation Indonesia, Malaysia and Japan 2025). Use cases can be voted on; the budget is hidden until sign-in.

**Creating a use case, four steps.**

1. Title and problem: title, problem statement, related AI technologies (ten kinds and "Other").
2. Outcomes and users: expected outcomes, the solution or vendor in use today, the users who benefit.
3. Data and budget: available data; integration, infrastructure and compliance requirements; a budget in USD or "TBD"; tags; up to ten attachments of 10 MB each.
4. Timeline and consent: delivery time, the deadline for proposals, the enterprise (an administrator can post on its behalf), and an option to hide the enterprise's name.

**An enterprise's use cases.** Approved, pending or rejected; a count of submissions and of matches; unpublish and delete.

**A startup's proposal.** Name, description of the solution and tech stack; optionally a registration number, founding date, address, form of collaboration, expected value, track record and notes; up to ten files. It can be edited or deleted until the deadline locks it.

**Organisation profiles.** An enterprise: name, website, headquarters, founding year, accepted email domains, industries, description, size, logo. A startup, as an enterprise sees it: company information (country, target industries, solution type, product stage, company type), products and technology, business model (segment, revenue model, ideal customer, funding), additional notes (problem solved, value proposition, competitors, milestones, paying customers) and documents (customer deck, product demo, pitch deck), with "Message" and "Book meeting".

**Registration.** A startup first searches for itself, because GenAI Fund imports startups ahead of their founders; if it is not there it creates the startup with name, website, country, founding year, 13 solution focus areas and 22 target industries. The founder then creates an account whose email must belong to an accepted domain. An enterprise registers the same way, against a separate list of 25 industry sectors.

**AI Match.** For one use case, the enterprise swipes through startup cards one at a time: pass, like, save or love. A card is either "AI selected" or a direct proposal. "My matches" lists both together, each with the match date, team size, a progress bar and the decision. Kai confirmed that this way of matching does not work: a candidate cannot be added by hand, a wrong match cannot be removed, and nothing explains why a card was selected.

**Other.** Message threads between an enterprise and a startup. Notifications for a new proposal and for an approved use case. An administration area for users, startups, enterprises and use cases, with CSV import and approval of use cases.

### Values in use

- Product stage: Prototype/MVP, Live PoC, Production/Live, Scaled/Growth, Sunset/Retired.
- Segment: B2B, B2C, B2B2C, C2B, B2G.
- Revenue model: subscription, pay-per-use, freemium, affiliate, advertising, licensing, pay-per-success, other.
- Funding: bootstrapped, angel, seed, bridge and later rounds.

### What the old data means for the new model

- Many profile fields are empty. In one list of 14 matched startups, 4 named their products, 5 had a value proposition and 7 a product stage.
- Fields with several values are stored as one string joined with `|||` or commas, and "Other: …" is written into the same field.
- There are three industry lists (22, 13 and 25 entries), and solution types are mixed with industries.
- Test records sit among real ones: an organisation named "aaaa", and use cases such as "Test (To be deleted)" that are still approved.
- Values carry typing errors ("Per-per-success"), the infrastructure field is free text, and the company type is stored as a code (`SUP`).

So, for BeyondPilot:

- **An organisation exists before its users.** Imported or researched data comes first and people arrive later, so an organisation is either unclaimed or claimed, by email domain or by invitation.
- **One taxonomy**, with a mapping from the three old lists.
- **Several values are stored as several values**; "other" is its own field.
- **Missing values are filled from decks and websites by AI**, and every value records its origin: declared by the provider, extracted by AI or migrated.
- **Test records are filtered at migration**, and the records left out are reported.

## Technical observations

- The old web client calls an API at `papi.genaifund.ai`. A refused request answers "Forbidden resource", the default message of NestJS, so the old backend is probably written with NestJS. The database is not known; both are to be confirmed with GenAI Fund before the migration.
- The pages of the administration area open for the view-only test account, but every request behind them is refused with 403, so they show no data. Access is enforced by the API, not by the pages.
- A use case's deadline is stored with its time zone (UTC+7), next to one category, a budget, attachments and the days remaining.
- An enterprise's matches for one use case, as seen in the test account: 14 candidates, of which 8 were marked love, 5 save and 1 pass.

## GenAI Fund's prototype of BeyondPilot

Kai's prototype, built with ChatGPT, is at `beyondpilot-prototype.dkang-kky.chatgpt.site`.

- **Navigation:** AI solutions, enterprise use cases, AI talent, programs and events.
- **Solutions list:** search, group chips and sorting. A card shows the name, the organisation, maturity (production or pilot), a description, focus areas, industries, the number of case studies and whether there is an offer.
- **Solution detail:** problems solved; target market and industry; focus areas; core technology; decks and demo; segment; best customer profile; monetisation; notable paying customers; milestones and traction; competitors; value proposition; funding. **Case studies** state the problem and a measured result. **Offers** state a description, a value, conditions, terms, a deadline and how to claim.
- **Use cases:** filtered by industry, with a "published opportunities" state.
- **Talent:** filtered by role: forward-deployed engineers, AI engineers, automation specialists.
- **Programs:** all, active, upcoming and past, with search, and a detail page for the AI for Insurance Challenge.
- Its sample solutions are fictional and marked as such; creating a solution, a use case or a talent profile exists only as a title.

## The interim application app (AI for Insurance Challenge)

Sign-in by email link. A four-step form (about you, organisation, solution, materials) and a review step. A button that asks AI for feedback on the application. A dashboard and a list of applications for the organiser.

## GenAI Fund's research method

Kai shared the skill he uses for researching vendors for one use case, kept as received in [sources/use-case-solution-research.md](sources/use-case-solution-research.md). It confirms the use case and its functional requirements, searches for candidates by the problem and not by a technology category, and assigns each candidate one bucket by the strength of its evidence: _direct relevance_, _industry relevance_ or _technology capability_. A candidate without a public customer case keeps its place with the gap stated. BeyondPilot's matching adopts the three buckets and the rule that unknown means unverified, and adds its own database as the first place to search.

## Main finding

The fields of a solution in the prototype, the solution step of the interim form and the startup card of the old AI Match are nearly the same thing. BeyondPilot therefore keeps **one solution profile**: a proposal adds only what is specific to a program or a use case (the answers, the deck, the demo), a returning applicant finds the known part filled in, and a provider keeps its own data current in one place.
