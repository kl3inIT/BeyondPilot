# BeyondPilot vision

This page states the outcomes BeyondPilot is meant to reach and the principles that stay stable while it is built. It is derived from GenAI Fund's [product brief](brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md), which remains the source for detailed requirements. What exists today is in [ARCHITECTURE.md](../ARCHITECTURE.md); scheduled work is in the [roadmap](roadmap.md).

## Outcomes

BeyondPilot connects enterprises that have business problems with AI solution providers and AI talent who can help solve them. GenAI Fund brings the two sides together through campaigns, challenges and other programmes. The first journey the product must carry end to end is:

> Launch a campaign featuring enterprise use cases → providers discover the opportunity → register and apply → reviewers assess proposals → shortlist suitable providers.

The release succeeds when GenAI Fund can show, with real partners, that it:

- launches a campaign without rebuilding the application process each time;
- onboards enterprises and providers with less help from its own team;
- makes enterprise requirements clear and discoverable;
- collects applications in one consistent place, reusing what a provider already entered;
- reviews and shortlists proposals with less manual coordination;
- builds a lasting catalogue of AI solutions, enterprise use cases and talent that stays useful between campaigns.

The people it serves are public visitors, enterprises seeking innovation, AI providers, individual builders and small teams, AI talent, GenAI Fund operators, and invited reviewers ([brief §3](brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#3-users-and-their-needs)).

**Phase 1** proves the campaign-to-shortlist journey and easier onboarding; the three directories stay in scope at a simpler depth. **Phase 2** extends on Phase 1 evidence and includes access from a user's own AI assistant through MCP. The planning context for Phase 1 is the AI for Insurance Challenge ([brief §14](brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#14-launch-context-and-dates-to-reconcile)).

## Product principles

- **The whole journey works.** An attractive directory alone is not the product; participation and review must work from end to end.
- **Less assistance, not more features.** A change earns its place by removing work from applicants or from the GenAI Fund team.
- **A person, an organization and a public profile are different records.** One person may take part in more than one capacity, and a solo builder never has to pose as an established company.
- **Reusable information.** What a provider or an enterprise has entered once is reused across campaigns.
- **Access is enforced on the server.** Non-public applications and files are protected by the backend, never only by what the interface shows.
- **AI assists and never blocks.** Matching and evaluation help reviewers; manual review always remains possible, and results can be tested against real needs.
- **Reuse before rebuild.** BeyondPilot revamps an existing platform; existing functions and data are assessed, and nothing is lost silently in migration.
- **Proportionate.** The product is not a transactional marketplace: no payments, escrow, contract management, public ratings, autonomous outreach or open-web scraping ([brief §17](brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#17-boundaries)).

## Target architecture

- One Spring Boot application whose business capabilities are Spring Modulith modules, and one Next.js web application in front of it, sharing one origin ([ADR 0001](decisions/0001-single-spring-boot-application-with-modulith-modules.md), [ADR 0002](decisions/0002-nextjs-frontend-over-the-spring-backend.md)).
- PostgreSQL as the system of record, with the schema owned by Flyway.
- The backend owns the API contract; the web consumes a client generated from it.
- Sign-in, sessions and authorization belong to the backend through Spring Security, without a separate identity server; the browser holds only an httpOnly session cookie.
- English and Vietnamese from the first screen.
- Operable by a small team: one command to run locally, a staging environment that follows the main branch, tested backups, and visible running costs.

Not yet decided, and therefore not part of this target: where the system is hosted; the email sign-in method (passwordless or password) beside Google; whether the existing Builder Hub and AI Talent systems are integrated, replaced or left as they are; the exact Phase 1 boundary and dates. Each becomes an ADR or a roadmap entry when it is accepted.
