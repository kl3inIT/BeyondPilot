<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Web application guide

For work under `web/`: the Next.js App Router application. This page points to the canonical rules in [docs/conventions.md › Frontend](../docs/conventions.md#frontend); it does not restate them. When they disagree, the linked source wins.

## Commands

Run from the repository root with `pnpm --dir web <script>`, or inside `web/`.

- `pnpm dev` serves the app on port 3000 and forwards Spring's paths to `BEYONDPILOT_API_ORIGIN` ([development runtime](../docs/runbooks/development-runtime.md#web-application)).
- `pnpm check` is the gate: the generated-client drift check, ESLint with the shadcn rules, Prettier, `tsc`, the unit tests, the message-catalog check and knip.
- `pnpm test:unit` runs the Vitest files (`src/**/*.test.ts`).
- `pnpm generate:api` regenerates `src/lib/api/generated` from the repository's `openapi.yml` ([refresh the API contract](../docs/runbooks/development-runtime.md#refresh-the-api-contract)). Never edit the generated files.
- `pnpm test:e2e` builds the app and runs Playwright with axe on desktop and mobile Chrome.
- `pnpm format` applies Prettier, including Tailwind class order.
- `pnpm dlx shadcn@latest add <component>` installs a registry component; the shadcn agent skill is in `.claude/skills/shadcn`.

## Where things live

| Path                         | Holds                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/`          | Every page. `(public)` and `(auth)` are route groups without a URL prefix; `workspace/` and `admin/` are URL segments with their own layouts          |
| `src/app/global-error.tsx`   | The failure screen when the root layout itself fails; the only inline bilingual copy                                                                  |
| `src/features/<domain>/`     | App screens of one business domain, flat: page components, parts, `<domain>-queries.ts`, `<domain>-schemas.ts`                                        |
| `src/components/sections/`   | Marketing page sections, one folder each (hero, logos, faq, cta, …)                                                                                   |
| `src/components/layout/`     | Site header, footer, mobile menu, and the admin sidebar                                                                                               |
| `src/components/actions/`    | Product actions: `Button`, `IconButton`, `TextButton` with `tone`/`prominence`/`size`/`pending`                                                       |
| `src/components/ui/`         | shadcn registry primitives (`components.json`, style `base-nova`)                                                                                     |
| `src/components/composites/` | Product patterns shared by several features, without data fetching or authority checks                                                                |
| `src/lib/`                   | `utils.ts` (`cn`), `api/generated/` (SDK and types from `openapi.yml`), `api/client.ts` (its configuration and `ApiError`), `auth/` (session helpers) |
| `src/i18n/`                  | Locale routing, request configuration, locale-aware `Link`, message typing                                                                            |
| `src/styles/tokens.css`      | Semantic design tokens, light and dark                                                                                                                |
| `src/instrumentation.ts`     | Logs server rendering errors as JSON                                                                                                                  |
| `src/proxy.ts`               | Locale routing only                                                                                                                                   |
| `messages/`                  | `en.json` and `vi.json`                                                                                                                               |
| `tests/e2e/`                 | Playwright specs and the axe helper                                                                                                                   |

## Rules to check before you edit

- **Structure and imports**: thin pages, app screens in flat domain features, marketing pages stacked from sections, feature imports follow backend module dependencies, `components/` imports nothing from `features/` or `app/` ([structure](../docs/conventions.md#structure)).
- **Server or client**: Server Components by default, `"use client"` on the smallest leaf; writes go to Spring with the CSRF header, never through Server Actions ([rendering, data and auth](../docs/conventions.md#rendering-data-and-auth)).
- **Text**: every visible string in both catalogs; dates in `Asia/Ho_Chi_Minh`; backend failures shown by code ([internationalization](../docs/conventions.md#internationalization)).
- **Errors and states**: `error.tsx`, `not-found.tsx` and `loading.tsx` per area; problem codes mapped to fields ([errors, loading and empty states](../docs/conventions.md#errors-loading-and-empty-states)).
- **Styling**: semantic tokens only, no raw colours, inline styles or arbitrary values ([design tokens and styling](../docs/conventions.md#design-tokens-and-styling)).
- **Components**: layer choice, naming, props, the `tone`/`prominence`/`size` action wrappers, states and accessibility ([components](../docs/conventions.md#components)).
- **Libraries**: add a library with its first consumer ([stack](../docs/conventions.md#stack)).
