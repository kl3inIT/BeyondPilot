# Plan: Messages

The design is [design.md](design.md). Each step leaves the gates green.

| #   | Step                                                                                                                                                                                                          | State                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | The `messaging` module: `V90`, conversations, requests and their answers, messages under a chosen identifier, read state, the clock, the stream of events, the six emails, the audit actions; `MessagingTest` | Done                                      |
| 2   | Web: `/workspace/messages` with the lists, the open conversation, the details column, the first message; the account menu; both catalogs; the unit tests of the screen's state                                | Done                                      |
| 3   | Backend cutover: the enquiry flow out of `talent`, its emails removed, `V91` moves its rows into conversations                                                                                                | Done                                      |
| 4   | Web cutover: Contact on a talent profile, a solution and a program leads to Messages; the enquiry screens and their words removed; `/admin/messages/reported`; the email kinds                                | Done                                      |
| 5   | `openapi.yml`, the generated client, `docs/specs/messaging.md`, `docs/tests/messaging.md`, `ARCHITECTURE.md`, ADR 0008, the roadmap                                                                           | Done                                      |
| 6   | The gates: `./gradlew :backend:check`, `pnpm --dir web check`, `pnpm --dir web test:e2e`; the flow walked in a browser with two accounts                                                                      | Done, see [verification](verification.md) |

Steps 1 and 2 cannot ship without 3 and 4: until then the application would hold two ways to write to the same person.

## Header message access

Move Messages from the account menu to a speech-bubble icon between the language selector and avatar. Reuse the existing unread API, refresh the count while the page is visible and on focus, retain the last count on failures, and verify zero, received and read states.
