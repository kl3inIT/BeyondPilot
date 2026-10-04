# Identity: plan

Design: [design.md](design.md). Tracked in Linear as BEY-30.

| # | Step | State |
| --- | --- | --- |
| 1 | Backend: the `identity` and `notification` modules, the security filter chain, the migration, `GET /api/identity/me`, the API contract and the generated web types | Done, 3 October 2026 |
| 2 | Web: the Sign in and Check your email pages from the Figma screens approved on 4 October 2026 | Done, 4 October 2026 |
| 2a | The emailed link replaced by a six-digit code, backend and web, after a review found that a forwarded link signs its reader into the sender's account | Done, 4 October 2026 |
| 2b | Web: the signed-in state of the header and sign out, once drawn and approved; the program line of "Sign in to apply", once the `program` module exists | Open |
| 2c | Web: `requireAccount` and `requireRole`, and the `/admin` page only an operator opens (BEY-44); the admin sidebar follows in the same issue | Done, 4 October 2026 |
| 3 | Operator management: Figma screen, then the API and the screen to grant and withdraw the operator role | After step 2 |
| 4 | A Google OAuth client and a mail provider for the development environment; a hand check of the Google round trip | Needs the credentials |

## Verification

- `./gradlew :backend:check`: the sign-in tests of [docs/tests/identity.md](../../../tests/identity.md) run over real HTTP against PostgreSQL.
- `pnpm --dir web test:e2e`: `tests/e2e/sign-in.spec.ts` covers the screens and their states with the backend's answers stood in for.
- Run on 4 October 2026 in a browser against the local stack: a code asked for on `/sign-in`, read in Mailpit, refused outside the asking browser, a wrong code refused with its message, the right code accepted, the session confirmed and the return path followed.
- Run on 3 October 2026 against the local stack: a link requested, read in Mailpit, redeemed, `me` answered, the link refused the second time, sign-out ended the session.

## Needed from outside the code

| What | For | Where it is managed |
| --- | --- | --- |
| Google OAuth client (id and secret) | Google sign-in on every environment | Environment variables `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_ID` and `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_SECRET`; never in Git |
| SMTP account of a mail provider | Sign-in codes on deployed environments | `BEYONDPILOT_MAIL_*`; never in Git |
| The list of operator addresses | The first operators | `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS` |
