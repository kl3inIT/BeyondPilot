# Plan: Personal data consent

The design is [design.md](design.md). Each step leaves the gates green.

| #   | Step                                                                                                                                                                                                                                         | State   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Backend record: `V112`, `Consents` (purposes, versions, the text file for version 1, the latest choice per purpose), `GET` and `PUT /api/identity/consent`, `consentNeeded` on `/me`, `openapi.yml` and the generated client; `IdentityConsentTest` | Done    |
| 2   | Backend gate: the MCP servers refuse an account without the current `platform` consent; the test sign-in agrees for the tests of other modules; tests                                                                                     | Done    |
| 3a  | Backend effects: `ConsentChanged`; the email confirming a withdrawal of `platform` (`consent_withdrawn`, group Account); `partners` required to submit an application or send a proposal; tests | Done    |
| 3b  | AI declined: `V113` `search_document.embeddable`, no embedding for the person's talent profile, re-indexed when the choice changes; their applications and proposals left out of what matching reads; tests | Done    |
| 4   | Web: `/consent` with the dialog, the redirect while `consentNeeded` (`requireAccount` and `ConsentRedirect`), the Settings section with Undo and the withdrawal confirmation, the privacy page, the sign-in line removed; both catalogs; `consent-text.test.ts` | Done    |
| 5   | `openapi.yml`, the generated client, `docs/specs/identity.md`, `docs/tests/identity.md`, `ARCHITECTURE.md`, the roadmap                                                                                                                     | Planned |
| 6   | The gates (`./gradlew :backend:check`, `pnpm --dir web check`); on staging: a new account, an existing account, Choose one by one, a withdrawal and its emails, an application without `partners`                                           | Planned |

Steps 1 to 4 ship together: without the page nobody could agree, and the MCP servers would refuse everyone.
