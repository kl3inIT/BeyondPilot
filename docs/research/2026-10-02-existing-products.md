# Existing products

Reviewed on 2 October 2026: the platform BeyondPilot replaces, GenAI Fund's own prototype of the new product, and the interim application for the AI for Insurance Challenge. The old platform was read with view-only access that GenAI Fund provided; nothing was created or submitted. All three are references. BeyondPilot's flows, statuses and data model are the team's to define.

## What GenAI Fund asked for at the kickoff

- 6 October 2026: the main flows as UI, for feedback. 9 October: the site live with listings of solutions, use cases, talent and programs, and applications arriving in the solutions database instead of the interim app. Before 16 October: AI matching.
- The old data is migrated in Phase 1, but its fields are not copied as they are: matching on keywords alone is not reliable enough to shortlist from.
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

**AI Match.** For one use case, the enterprise swipes through startup cards one at a time: pass, like, save or love. A card is either "AI selected" or a direct proposal. "My matches" lists both together, each with the match date, team size, a progress bar and the decision. Swiping one card at a time does not scale to a shortlist: a candidate cannot be added by hand, a wrong match cannot be removed, and nothing explains why a card was selected.

**Other.** Message threads between an enterprise and a startup. Notifications for a new proposal and for an approved use case. An administration area for users, startups, enterprises and use cases, with CSV import and approval of use cases.

### Values in use

- Product stage: Prototype/MVP, Live PoC, Production/Live, Scaled/Growth, Sunset/Retired.
- Segment: B2B, B2C, B2B2C, C2B, B2G.
- Revenue model: subscription, pay-per-use, freemium, affiliate, advertising, licensing, pay-per-success, other.
- Funding: bootstrapped, angel, seed, bridge and later rounds.

### What the old data means for the new model

- Many profile fields are empty. In one list of 14 matched startups, 4 named their products, 5 had a value proposition and 7 a product stage.
- Fields with several values are stored as one delimited string, and "Other: …" is written into the same field.
- There are three industry lists (22, 13 and 25 entries), and solution types are mixed with industries.
- Test records sit among real ones.

So, for BeyondPilot:

- **An organisation exists before its users.** Imported or researched data comes first and people arrive later, so an organisation is either unclaimed or claimed, by email domain or by invitation.
- **One taxonomy**, with a mapping from the three old lists.
- **Several values are stored as several values**; "other" is its own field.
- **Missing values are filled from decks and websites by AI**, and every value records its origin: declared by the provider, extracted by AI or migrated.
- **Test records are filtered at migration**, and the records left out are reported.

## GenAI Fund's prototype of BeyondPilot

- **Navigation:** AI solutions, enterprise use cases, AI talent, programs and events.
- **Solutions list:** search, group chips and sorting. A card shows the name, the organisation, maturity (production or pilot), a description, focus areas, industries, the number of case studies and whether there is an offer.
- **Solution detail:** problems solved; target market and industry; focus areas; core technology; decks and demo; segment; best customer profile; monetisation; notable paying customers; milestones and traction; competitors; value proposition; funding. **Case studies** state the problem and a measured result. **Offers** state a description, a value, conditions, terms, a deadline and how to claim.
- **Use cases:** filtered by industry, with a "published opportunities" state.
- **Talent:** filtered by role: forward-deployed engineers, AI engineers, automation specialists.
- **Programs:** all, active, upcoming and past, with search, and a detail page for the AI for Insurance Challenge.
- Its sample solutions are fictional and marked as such; creating a solution, a use case or a talent profile exists only as a title.

## The interim application app (AI for Insurance Challenge)

Sign-in by email link. A four-step form (about you, organisation, solution, materials) and a review step. A button that asks AI for feedback on the application. A dashboard and a list of applications for the organiser.

## Main finding

The fields of a solution in the prototype, the solution step of the interim form and the startup card of the old AI Match are nearly the same thing. BeyondPilot therefore keeps **one solution profile**: a proposal adds only what is specific to a program or a use case (the answers, the deck, the demo), a returning applicant finds the known part filled in, and a provider keeps its own data current in one place.
