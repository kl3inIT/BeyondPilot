# ADR 0002: Next.js frontend over the Spring backend

- Status: Accepted
- Date: 2026-10-01
- Decision owner: BeyondPilot team

## Context

BeyondPilot's public pages (campaigns, enterprise use cases, the solution and talent directories) are shared through partner and social links and should be indexable in English and Vietnamese. Behind sign-in there are workspaces for applicants, reviewers and GenAI Fund operators. The backend is one Spring Boot application ([ADR 0001](0001-single-spring-boot-application-with-modulith-modules.md)) that owns business rules, authorization and the browser session.

The team's reference project, MemoryOS, serves a Vite and TanStack Router single-page application that is entirely behind sign-in. That shape renders nothing on the server, so public pages would need a separate solution for search engines and link previews.

## Decision

- The frontend is a Next.js 16 App Router application in `web/`, generated with `create-next-app` and the React Compiler, styled with Tailwind CSS 4 and shadcn/ui (`base-nova`, Base UI primitives).
- Spring remains the only backend. Next.js holds no business rules and no database access, and does not use Server Actions for writes. Public pages read on the server through the API, forwarding the session cookie; writes go from the browser to Spring with the CSRF header.
- The browser sees one origin: a reverse proxy routes Spring's paths when deployed, and Next.js rewrites them during development.
- The interface is bilingual with next-intl: English by default without a URL prefix, Vietnamese under `/vi`.
- The production build uses `output: "standalone"` and runs as its own container.
- Lint is ESLint with `eslint-config-next` and `@shadcn/lint`; formatting is Prettier.

## Alternatives considered

- **MemoryOS's Vite and TanStack Router SPA.** The team knows it, but it cannot render public pages on the server; search indexing and link previews would need a separate rendering path.
- **TanStack Start.** Keeps TanStack Router, but its ecosystem and documentation are thinner than Next.js's for a public, bilingual site on a two-week schedule.
- **Oxlint instead of ESLint.** Faster and used by MemoryOS. Oxlint 1.86 covers 21 of the 22 Next.js rules and most React Compiler rules, but not `use-memo`, `incompatible-library`, `globals`, `error-boundaries` or `unsupported-syntax`, which `eslint-config-next` enables and which matter with the React Compiler turned on. Revisit when Oxlint covers them; `@shadcn/lint` works with both.

## Consequences

- Production runs a Node.js container next to the Spring container, behind one reverse proxy.
- Server-side reads must forward the session cookie and must not cache authenticated data in the shared data cache.
- On Windows development machines the standalone server and the SWC native cache need the workarounds in the [development runtime runbook](../runbooks/development-runtime.md#web-application); Linux CI and containers are unaffected.
