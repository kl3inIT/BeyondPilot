# Verification: Messages

What was run on 13 October 2026, on the branch `anhnd05122004/bey-173-messages-a-real-time-chat` after `main` was merged into it.

## Gates

| Gate                       | Result                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `./gradlew :backend:check` | Passes                                                                                                     |
| `pnpm --dir web check`     | Passes: lint, format, types, 657 unit tests, both catalogs with 5500 keys, 229 failure codes covered, knip |
| `pnpm --dir web test:e2e`  | 604 pass, 6 skipped                                                                                        |

Before the merge of `main`, one full run failed `workspace-organization.spec.ts:735` on desktop (Approve still disabled), which passed when its file was run again alone, and `how-it-works.spec.ts:28` wavered when run in a group. `main` has since steadied its end-to-end tests (BEY-170), and the run above is clean.

On this Windows machine the backend gate needs `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh`: the JVM's default zone name `Asia/Saigon` is one PostgreSQL 18 refuses.

## The migration

`V90` was applied by hand, with `psql` in one transaction, to a throwaway `pgvector/pgvector:0.8.7-pg18-trixie` that held V1 to V89 and ten enquiries of every status. Flyway itself applies it only to the empty databases of the gate.

- Two accepted enquiries and a later waiting one of the same sender and profile became one open conversation of three messages in the order written, started when the first was written, answered when the later acceptance was given; the message written after it is unread for the profile's person.
- A declined, a reported and a closed enquiry each stayed a conversation of its own, with its times; a waiting one kept its time and its reminder.
- A text of 2500 characters became a message of 2000; a row whose text was blank became nothing.
- An enquiry that would have waited beside a conversation already there became a closed conversation.
- No conversation without a message, no two that wait or are open for one sender and profile, `seq` in the order of time; the wording of the removed emails is gone, an email already sent under a removed kind stays in the log, and the table is dropped.

## The flow in a browser

The backend (`bootRun`, on a database of its own) and the web development server ran locally, with Mailpit for the emails, before `main` was merged; the walk was not repeated after the merge. Two accounts signed in with the emailed code in two Chromium windows at 1440 wide, driven by Playwright; neither window was reloaded between the steps.

1. Contact on a talent profile opened Messages with the first message to write.
2. After sending, the sender read that the request waits and until when. The person written to got the email "A first message for you on BeyondPilot".
3. They found it under Requests, read that the sender is new, and accepted; the composer opened.
4. The sender's window heard the acceptance and its composer opened. The sender got the email "Your message was accepted".
5. While the person wrote, the sender's window said they were writing, then showed the message; the writer's window then said "Seen".
6. Two answers appeared in order in the other window.
7. With the person on another page, a further message came; on their return the list showed the conversation with a count of 1, the tab counted 1 and the account menu showed its dot.
8. At 390 wide the list and the conversation took turns.

**Found by this walk:** the web development server compressed the event stream and so held every event back until the stream ended. The stream now answers `Cache-Control: no-store, no-transform`. Matching's stream has the same header as before and so the same delay behind the development server; behind nginx neither is compressed.

**Not walked in a browser:** a conversation with a solution's organization and with GenAI Fund about a program, decline and report, the operators' reported list, a lost connection, and a message that fails to send. The backend test and the end-to-end tests against stub backends cover them. Nothing was tried on staging.

A person who has just left Messages is still counted as listening until their stream is found closed, which can take until the next comment line, 20 seconds: a message written in that time brings them no email.
