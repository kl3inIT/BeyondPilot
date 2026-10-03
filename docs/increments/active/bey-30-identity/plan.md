# Identity: plan

Design: [design.md](design.md). Tracked in Linear as BEY-30.

| # | Step | State |
| --- | --- | --- |
| 1 | Backend: the `identity` and `notification` modules, the security filter chain, the migration, `GET /api/identity/me`, the API contract and the generated web types | Done, 3 October 2026 |
| 2 | Web: the Sign in, Check your email and link pages from the Figma file (BEY-27), the signed-in state of the header, sign out | Next |
| 3 | Operator management: Figma screen, then the API and the screen to grant and withdraw the operator role | After step 2 |
| 4 | A Google OAuth client and a mail provider for the development environment; a hand check of the Google round trip | Needs the credentials |

## Verification

- `./gradlew :backend:check`: the sign-in tests of [docs/tests/identity.md](../../../tests/identity.md) run over real HTTP against PostgreSQL.
- Run on 3 October 2026 against the local stack: a link requested, read in Mailpit, redeemed, `me` answered, the link refused the second time, sign-out ended the session.

## Needed from outside the code

| What | For | Where it is managed |
| --- | --- | --- |
| Google OAuth client (id and secret) | Google sign-in on every environment | Environment variables `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_ID` and `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_SECRET`; never in Git |
| SMTP account of a mail provider | Sign-in links on deployed environments | `BEYONDPILOT_MAIL_*`; never in Git |
| The list of operator addresses | The first operators | `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS` |
