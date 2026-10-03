# Product

<!-- impeccable:product-schema 1 -->

> Written on 2 October 2026 without Impeccable's interview, at the team lead's request. Facts come from the [product brief](docs/brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md), the kickoff with GenAI Fund on 2 October 2026 and decisions the team has recorded. Lines marked *(inferred)* are reasoned from those sources and still need confirmation. Detailed outcomes live in [docs/vision.md](docs/vision.md); this file keeps what design work needs.

## Platform

web

## Users

- **GenAI Fund operators.** The people who run programs and scout AI solutions for enterprises. Today one use case takes about three months of research, shortlisting and outreach. They work at a desk, across many candidates at once.
- **Enterprise innovation teams.** Tasco, Shinhan, Nestlé and the enterprises of each country's open innovation call. They describe a business problem, review proposals and pick providers for a pilot.
- **AI providers.** Startups, ISVs, system integrators and established technology companies such as OpenAI. They showcase solutions with proof, find opportunities, apply and follow the outcome. Many arrive on a phone, from a partner or social link to a campaign page, with a hard deadline (for example 15 October 2026, 23:59 ICT).
- **Builders and small teams.** Solo builders, student and hackathon teams. They apply without posing as an established company.
- **AI talent.** Specialists such as forward-deployed engineers, AI engineers and automation specialists. They show skills and projects, and receive enquiries without exposing an email address.
- **Invited reviewers and judges** for a single program.

## Product Purpose

BeyondPilot connects enterprises' business problems with AI solutions and talent through GenAI Fund's programs. It makes one cycle repeatable: a use case, sourcing from the database and from applications, review, then a shortlist of three to five providers.

Success means:

- a campaign launches without rebuilding the application process;
- providers and enterprises onboard without help from GenAI Fund's staff;
- proposals arrive in one place and reuse what a provider already entered;
- a shortlist takes days, not months;
- the catalog of solutions, use cases and talent stays useful between campaigns.

## Positioning

- Run by an AI venture fund with real enterprise programs. The people who set a brief hold the budget and sit at demo day (source: the Insurance Challenge page).
- Solutions with proof, not a directory of logos. Customer cases, deployments and demos come with their sources, and a candidate's fit is classified as *direct relevance*, *industry relevance* or *technology capability* rather than scored by keywords. *(inferred from Kai's research skill and the prototype's "AI solutions, with proof")*
- Every research run and every application enriches the same database, so the next search starts from what is already known.
- Later (Phase 2), reachable from a user's own ChatGPT through MCP.

## Operating Context

- **Program types:** enterprise challenges (Tasco, Shinhan), open innovation calls run per country (Vietnam, Japan, Malaysia, Indonesia), accelerators, hackathons and buildathons, grants, meetups and workshops. Events are published on Luma; stories on the genaifund.ai blog.
- **What it replaces:**
  - app.genaifund.ai (about 2,500 startups, 208 use cases, keyword matching with swipe-style Love/Save/Pass);
  - the Lovable application for the Insurance Challenge (email-link sign-in, a four-step form);
  - Google Sheets;
  - Kai's research skill run in ChatGPT and Codex.
- **Materials:** decks (PDF up to 10 MB), demo links, proposals, and per-campaign questions. Deadlines are set in Vietnam time (ICT).
- **Languages and region:** English by default, Vietnamese under `/vi`. The focus is Southeast Asia, Vietnam first.

## Capabilities and Constraints

- **Phase 1 dates:**
  - 6 October 2026: main flows as UI.
  - 9 October: the live site, with listings of programs, solutions, use cases and talent, and a working application flow.
  - Before 16 October: AI matching.
- **Sign-in:** Google or an email link. No passwords.
- **Access:** authorization is enforced on the server; non-public proposals and files are protected.
- **Out of scope:** transactions, payments, ratings and contract management. Automatic outreach and MCP are Phase 2.
- **Undecided:**
  - web research in Phase 1 (BEY-23);
  - messaging, use case voting and anonymous use cases (BEY-24);
  - who creates offers, and joining an organization by email domain (BEY-25);
  - an official BeyondPilot identity from GenAI Fund (logo, colours); the team's own palette stands in until then.
- **Terms:** Program, Use case, Solution, Proposal, Candidate and Organization have one meaning each; see the glossary in the [Phase 1 domain model](docs/increments/active/bey-22-phase-1-domain-model/design.md#glossary) once it is merged.

## Brand Commitments

- **Name and logo:** BeyondPilot, shown with "Powered by GenAI Fund" and the GenAI Fund logo (`web/public/brand/`).
- **Our own palette until GenAI Fund provides an identity.** The interim campaign page uses DM Sans, Space Grotesk and purple; none of that is adopted, and purple and indigo are rejected. Since 3 October 2026 BeyondPilot uses its own azure-on-paper palette with Inter ([DESIGN.md](DESIGN.md)).
- **Expressive but real:** light, arcs, icons and motion are welcome; every card, number and name on a page is real. No "announcement" sparkle pills, no invented statistics, no fake notification cards.
- **Voice:** plain, direct and practical; facts and deadlines stated as they are ("You don't need a finished product. You need a point of view and three weeks."). *(inferred from the current copy)*

## Evidence on Hand

- **Real content:**
  - the AI for Insurance Challenge: question, directions, dates, judges, terms;
  - 21 GenAI Fund programs and 56 events from the blog and Luma (Linear document "Dữ liệu Programs & Events từ blog và Luma (2/10)");
  - partner logos from genaifund.ai;
  - the v1 data export, expected on 5 October 2026.
- **Not available, never to be invented:** testimonials, usage metrics or customer counts for BeyondPilot itself. The prototype's sample solutions are fictional ("Mock solution profile").

## Product Principles

1. **The whole journey works.** Applying, reviewing and shortlisting matter more than an attractive directory.
2. **Proof before claims.** A solution's facts show their source and kind of evidence; what is unknown is shown as unknown, never as zero.
3. **Remove work.** Each step should save effort for an applicant or for GenAI Fund's team.
4. **Humans decide, AI assists.** AI suggests and explains; operators add, dismiss and shortlist, and nothing waits for AI.
5. **Enter once, reuse everywhere.** What a provider enters once fills every later application.

## Accessibility & Inclusion

- WCAG 2.2 A and AA. Axe runs in CI and fails on serious or critical findings.
- Vietnamese runs 20–30% longer than English, and fonts must cover its diacritics.
- Status is never carried by colour alone.
- Applicants often come from a phone, so the application flow works first on a small screen.
