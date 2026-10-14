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

`V91` was applied by hand, with `psql` in one transaction, to a throwaway `pgvector/pgvector:0.8.7-pg18-trixie` that held the migrations before it and ten enquiries of every status. It was then V90 after V89; `main` has since taken V89, and the two are V90 and V91 with their SQL unchanged. Flyway itself applies it only to the empty databases of the gate.

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

## The other flows, after the merge of `main`

Walked the same way on 13 October 2026 on a local stack at the merged commit, whose database had been migrated by Flyway from enquiries of earlier development, with accounts made for the walk. 40 of 42 checks passed; the two that did not were faults of the script, each then checked another way.

- **Talent, again:** the eleven steps above, with the two emails.
- **A lost connection:** with the event stream refused for one window, the conversation said the connection was lost and a message written meanwhile did not show; once the stream was allowed again the message showed without a reload and the notice went. (Playwright's offline mode does not cut a stream that is already open, so the first attempt showed nothing.)
- **Decline and report:** with the window open, the Requests tab counted two; a declined and a reported request each left the list of the person who answered, both senders' open windows said it would not be taken further, and the sender got the email "Your message on BeyondPilot" (the script looked for another subject).
- **Operators:** `/admin/messages/reported` listed the reported first message with its sender, beside one that `V91` had moved from a reported enquiry; a person who is not an operator did not read it.
- **A solution:** Contact on the solution page opened the first message; an owner of the provider was emailed; a member who is not an owner read the request and was told only owners answer; an owner accepted; the member's open window heard it and wrote; the buyer read the message under the member's name; both colleagues read the buyer's answer live.
- **A program:** "Ask GenAI Fund" on a published program opened a conversation with no request; an operator found it among the chats and answered; the answer arrived in the asker's open window.
- **The list and the menu:** the conversation written in last showed what was written, and the account menu showed Messages with a count of 1.

Seen and left: in the operators' list the sender's name and address are cut short at 1440 wide while the message column has room.

**Not walked in a browser:** a message that fails to send and is tried again, a request that closes after fourteen days, and anything on staging.

A person who has just left Messages is still counted as listening until their stream is found closed, which can take until the next comment line, 20 seconds: a message written in that time brings them no email.

## Follow-up corrections on 13 October 2026

The review of the finished screen found that a client could mark messages beyond the conversation's latest `seq`, retrying a first message after a lost response could duplicate it or be refused, and Back/Forward could leave the visible conversation different from `?c=`. The first message now carries a stable identifier; the backend returns the existing conversation for a retry and rejects a read position beyond its latest message. The screen follows `?c=` and ignores an obsolete conversation response. The textarea always shows its remaining characters, and the read marker no longer labels a sent time as the time it was seen.

`./gradlew :backend:check` passed with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh`. `pnpm --dir web check` passed with 657 unit tests, 5501 message keys and 230 covered failure codes. The focused Playwright tests for Back/Forward and Contact passed on desktop and mobile (four runs). In this Windows worktree, the test build used `next build --webpack` because Turbopack could not resolve the worktree's linked `node_modules`; the committed Playwright command remains `next build`.

A later static review found two more cases: a pending request's reader could reveal they had opened it, and a slow refresh could erase a message received on the event stream after the server took its snapshot. Both now have regression tests at the HTTP and state boundaries respectively.

After these changes, `./gradlew :backend:check --no-daemon` passed with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh`, and `pnpm --dir web check` passed with 658 unit tests, 5501 message keys and 230 covered failure codes. SonarQube Scanner and a SonarQube server were not available locally; the review used the repository gates and manual static inspection.

## Admin reported messages review on 14 October 2026

Figwright 0.6.0 connected to the open `BeyondPilot — Product UI` Figma file. `Screens` has no dedicated Reported messages frame, so the Admin Audit log desktop frame (`178:27970`) supplied the table spacing and information hierarchy. The report list now presents the sender, the subject and full message, then the report date. This also resolves the clipped sender observed above: the sender column has enough room for a name, and email addresses wrap. The mobile table keeps the sender and message first when it scrolls sideways. The lead now says plainly what the operator is reviewing.

`pnpm --dir web check` passed with 668 unit tests, 5520 message keys and 230 covered failure codes. The focused Admin reported messages Playwright suite passed on desktop and mobile (four runs, including axe). The rendered page was inspected at 1440 × 900 and 390 × 844.

## Header message shortcut — 15 October 2026

- Moved Messages between the language selector and avatar, using the supplied speech-bubble reference and the existing unread API. The compact notification badge counts unread messages plus pending requests and disappears at zero.
- `pnpm --dir web check` passed: generated-client drift, ESLint, Prettier, route types and TypeScript, 77 test files / 672 tests, matching catalogs and error codes, and knip.
- `header-messages.test.tsx` verifies the destination, zero, received and read counts, preserving counts on failure, focus refresh, and skipping hidden tabs.
- `pnpm --dir web test:e2e messages.spec.ts --project=desktop --project=mobile` passed: 24 browser tests, including the messaging and admin reported messages suites and accessibility checks on desktop and mobile. Updated the existing tests to find the header shortcut and assert that Messages is absent from the account menu.
- Focused ESLint and Prettier checks for the updated browser spec passed. `git diff --check` passed.

After synchronizing the PR branch with main, `pnpm --dir web check` passed again: 82 test files / 717 tests, 5719 matching catalog keys, 247 covered failure codes, and all other gate steps. Conflict resolution preserves main’s removal of reported-message administration and keeps the header shortcut, its count and the updated browser tests. The 24-test browser result above was obtained before this synchronization.

## Header icon consistency — 15 October 2026

Replaced the 24px `MessageCircleMoreIcon` with the messaging screen’s existing Lucide `MessagesSquareIcon` at 20px. `pnpm --dir web check` passed: 82 test files / 717 tests, matching catalogs (5719 keys), 247 covered failure codes, and the remaining gate steps. The current main was already contained in anhnd; no merge conflict was present.
