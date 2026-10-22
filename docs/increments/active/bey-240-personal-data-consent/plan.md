# Plan: Personal data consent

The design is [design.md](design.md). Each step leaves the gates green.

| #   | Step                                                                                                                                                                                                                                         | State   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Backend record: `V111`, `Consents` (purposes, versions, the text file for version 1, the latest choice per purpose), `GET` and `PUT /api/identity/consent`, `consentNeeded` on `/me`, `openapi.yml` and the generated client; `IdentityConsentTest` | Done    |
| 2   | Backend gate: the `consentGiven` check supplied to the filter chain, `CONSENT_REQUIRED`, the MCP token check; tests that a signed-in account without consent is refused and public reads stay open                                          | Planned |
| 3   | Backend effects: `ConsentWithdrawn` and its two emails in `notification`; `partners` required to submit an application or proposal; `AiConsentChanged` handled by `search` and `matching`, and no AI evaluation for an applicant without `ai`; tests | Planned |
| 4   | Web: `/consent` with the dialog, the redirect while `consentNeeded`, the Settings section with Undo, the forms without `partners`, the privacy page, the sign-in line removed; both catalogs; unit tests                                    | Planned |
| 5   | `openapi.yml`, the generated client, `docs/specs/identity.md`, `docs/tests/identity.md`, `ARCHITECTURE.md`, the roadmap                                                                                                                     | Planned |
| 6   | The gates (`./gradlew :backend:check`, `pnpm --dir web check`); on staging: a new account, an existing account, Choose one by one, a withdrawal and its emails, an application without `partners`                                           | Planned |

Steps 1 and 2 ship together with 4: a gate without the page would lock everyone out.
