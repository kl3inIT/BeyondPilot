# Messages: conversations with solution providers, AI talent and GenAI Fund

A signed-in person writes to the organization behind a solution, to the person behind a talent profile or to GenAI Fund about a program, and the two sides then talk on BeyondPilot, each message arriving while the screen is open. Tracked in Linear as BEY-173.

It replaces the enquiries through a talent profile ([BEY-36](../bey-36-talent-enquiries-and-review/design.md), with "Messages you sent" and the Enquiries tab), which ended in an exchange of email addresses. The requests for an introduction to a solution's provider ([BEY-34](../bey-34-solution-introductions/design.md)) had worked the same way; BEY-172 removed them on 13 October 2026, while this increment was being built, because none had ever been sent. What was studied is in the [research note](../../../research/2026-10-13-messaging-references.md). The screens are the note "I · PROPOSAL 13/10" and the frames under it in the section `AI talent — directory, profile, enquiries and review` of `BeyondPilot — Product UI`. The decisions were taken on 13 October 2026 by the member who directs BEY-173, on the screens and on a clickable prototype.

## What a person can do

- **Start from Contact.** Contact on a talent profile, on a solution or on a program opens Messages with the first message to write: who will read it and what becomes of it are said before anything is sent.
- **Send a first message.** To a person or an organization it waits as a request. They are told by email, without the sender's address. To GenAI Fund the conversation is open at once.
- **Answer a request.** The side written to finds it under Requests and accepts, declines or reports it. The sender is not told that it was read. An acceptance opens the conversation; a decline and a report both tell the sender only that it will not be taken further.
- **Talk.** In an open conversation both sides write. A message appears at once on the screens that are open, with who wrote it; the list moves that conversation to the top and counts what the reader has not read; the other side sees "is writing" and how far their messages were read.
- **Be told when away.** A person with no screen open gets one email that a message waits, and no other until they have read the conversation.
- **Find it again.** Messages is in the account menu, with how many messages and requests wait.
- **Let a request close.** A request nobody answers closes after 14 days, which the sender is told; the side written to is reminded once on the seventh day.
- **Read reports, as an operator.** Under Admin, the first messages that were reported, with who sent them. An operator reads no other conversation.

## Boundary discovery

### Domain story

1. Minh, of the enterprise Tasco, opens the solution "Claims voice agent" of Arcanic AI and chooses Contact. Messages opens with a first message to write; it says that everyone at Arcanic AI can read it and that it waits until they accept.
2. Minh writes. The owners of Arcanic AI get an email: Minh of Tasco wrote about Claims voice agent. No address is in it.
3. Juin, an owner, opens Messages › Requests, reads the message and accepts. Minh gets an email, and the conversation is open.
4. Juin's colleague Tuan answers. Minh's screen shows the message at once, named "Tuan Phong". Minh answers; "Seen" appears under Tuan's message for Arcanic AI.
5. Failure paths: the owners decline (Minh is told, may write again later); they report it (Minh is told the same, an operator reads the report); nobody answers (a reminder on day 7, closed on day 14); Minh's connection drops (the screen says so, and reads what it missed when the stream is back); a message is not delivered (it says "Not sent" with Try again, and the retry writes it once).

The same story holds for a talent profile, with one person in place of the organization, and for a program, where GenAI Fund's operators are the other side and no request is needed.

### Glossary

| Term            | Meaning                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conversation    | The messages between one person and one other side about one subject                                                                                                           |
| Subject         | What the conversation is about, and what decides the other side: a talent profile, a solution or a program. One conversation that waits or is open for each person and subject |
| Starter         | The person who wrote first. Always one account, even when they belong to an organization, whose name the other side reads                                                      |
| Recipient side  | The person behind the profile; every member of the organization that offers the solution; GenAI Fund's operators for a program                                                 |
| Request         | A conversation whose first message waits for the recipient side: `pending`. It becomes `accepted`, `declined`, `reported` or `closed`                                          |
| Answer          | Accept, decline or report. The person behind a profile answers for themselves; for an organization its owners do, as they decide for it. Final                                 |
| Read            | How far one account has read one conversation: the `seq` of the last message. Unread is what the other side wrote after it                                                     |
| Event           | Something told to the open screens of a conversation's people: a message, a read, that someone is writing, that a conversation started or was answered                         |
| Message (email) | Not this. An email the application sends is an "email"; a "message" is always a message of a conversation                                                                      |

### Commands, events and read models

- **Commands:** start a conversation (write a first message), send a message, mark read, say typing, accept, decline, report. The clock: remind, close.
- **Facts told to open screens** (not module events): message written, read up to, typing, conversation changed. They never leave the instance and are not stored.
- **Read models:** the caller's two lists with the last message and the unread count; one conversation with a page of messages, its subject as its public page says it now, and who is on the other side; the totals for the account menu; the operators' reported list.
- **Synchronous invariants:** at most one conversation that waits or is open for a starter and a subject (a partial unique index); a message is written once for an identifier (primary key); an answer is given once (row lock); only an accepted conversation is written in.
- **Asynchronous reactions:** emails, queued in the transaction of the change and sent after commit by `notification`.

### Data and invariant owner

`messaging` owns `messaging_conversation`, `messaging_message` and `messaging_read`, and every rule above. No other module reads or writes them.

### Context map

| Question                       | `messaging`                                                                                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does it own?              | Conversations, their messages, how far each reader read, the requests and their answers                                                                                                                                                                                      |
| Who changes its data?          | A signed-in person on either side; the clock, which reminds and closes                                                                                                                                                                                                       |
| What does it need from others? | `talent` (the person behind a listed profile, the profile as its page says it), `solution` (the approved solution at an address, its page), `program` (the published program at an address), `organization` (membership, owners, names), `identity`, `notification`, `audit` |
| What do others need from it?   | Nothing                                                                                                                                                                                                                                                                      |
| Why not part of `talent`?      | The same conversation, request and read rules hold for solutions and programs. Keeping them in `talent` would have made `solution` and `program` depend on `talent`, or repeated them twice                                                                                  |

The edges are `messaging → audit, identity, notification, organization, program, solution, talent`; none points back. `talent` gains `TalentDirectory.recipient(slug)` and no longer depends on `organization`, which only its enquiries needed. The accepted decision is [ADR 0008](../../../decisions/0008-a-messaging-module-carries-conversations.md).

## Decisions

1. **One conversation for each person and subject.** The old platform showed several threads with one organization; a second thread with the same people about the same solution splits what they said. A person who writes again to someone they talk with writes in the open conversation.
2. **A first message is a request, except to GenAI Fund.** As Messenger, Instagram and X do for someone new, and as BEY-34 and BEY-36 already required an answer before anything was shared. GenAI Fund runs the programs and answers as part of its work.
3. **The rules against unwanted mail stay.** One waiting request for a sender and a subject, ten new conversations a sender a day, a reminder on day 7, closed on day 14 (BEY-36, decisions 3 and 6). A person in an open conversation writes at most 30 messages a minute.
4. **A solution provider reads which organization asks.** The sender must belong to an approved organization, as a request for an introduction required (BEY-34, decision 2). A talent profile and a program are written to by anyone signed in.
5. **A conversation with a provider belongs to the organization.** Every member reads and writes it, and each message names its writer; owners answer the request (BEY-34, decision 3). A person who leaves the organization stops reading it.
6. **No email address is shown, ever.** Chat replaces the exchange of addresses. People who want to talk elsewhere write their address themselves.
7. **A report reads as a decline to the sender** (BEY-36, decision 4), and an answer is final (decision 5).
8. **Live through server-sent events, written by POST.** Matching already streams events through the proxy with the session cookie ([live.md](../bey-39-matching/live.md)); a WebSocket would add a second transport, its own authentication and proxy rules, for a flow where only the server pushes. An event carries the message itself, so the screen shows it without asking again.
9. **Every message is sent under an identifier the screen chooses, including the first one.** A message in an open conversation appears at once while it is sent; the backend writes it once. A retry of the first message returns the conversation already started, even after the recipient accepted or declined it.
10. **Nothing is replayed on the stream.** A screen reads the lists and the messages after the last one it holds whenever its stream opens. The server ends each stream after ten minutes, so that who may hear is decided again from who the person is now.
11. **An absent person gets one email until they read.** Without it a message would wait unseen; with one for each message a conversation would flood an inbox. GenAI Fund's operators are not emailed: they read Messages as part of their work.
12. **The topic and the signed name of an enquiry are dropped.** The first message says what it is about; a sender without a name reads as "Someone", and no address depends on it any more (BEY-36, decision 14).
13. **The details column acts on nothing.** It says what the conversation is about, with the way to its page, and who reads it. A next-step button (add the solution to a use case, or share contact details) was tried in a clickable prototype on 13 October 2026 and left out.
14. **In Messages, operators read reported requests only.** A conversation is its two sides' alone. One thing reaches operators another way: the email of a first message quotes its text, and Admin › Email › Activity shows operators every email that was sent, so an operator can read a first message there, as they could read an enquiry before. No later message is in any email.
15. **A profile its person deletes takes its conversations with it**, as it took its enquiries (BEY-36).
16. **A solution page has Contact.** [BEY-148](../bey-148-solution-offers/design.md) removed "Request an introduction" from the public solution page on 12 October 2026, because the brief gives that page no action, and BEY-172 then removed the requests themselves. Writing to a solution's provider is what this increment was asked for, and without an action on that page nobody could start such a conversation, so the page gets one Contact that leads to Messages, as a talent profile has. Confirmed on 13 October 2026 by the member who directs BEY-173; it reverses a decision another member took a day earlier, and the pull request says so.

## HTTP

| Path                                                                     | Use                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `GET /api/messaging/conversations`                                       | The caller's chats and requests, the one written in last first                     |
| `GET /api/messaging/unread`                                              | The totals for the account menu                                                    |
| `GET /api/messaging/prospect?kind=&slug=`                                | Who a first message would go to, and the conversation the caller already has there |
| `POST /api/messaging/conversations`                                      | Write a first message                                                              |
| `GET /api/messaging/conversations/{id}`                                  | One conversation with its latest 50 messages, its subject and the other side       |
| `GET /api/messaging/conversations/{id}/messages?before=&after=`          | Earlier messages, or what was written while the screen was away                    |
| `POST /api/messaging/conversations/{id}/messages`                        | Write a message, under an identifier the caller chooses                            |
| `POST /api/messaging/conversations/{id}/read`, `…/typing`                | How far the caller has read; that the caller is writing                            |
| `POST /api/messaging/conversations/{id}/accept`, `…/decline`, `…/report` | The answer of the side written to                                                  |
| `GET /api/messaging/events`                                              | Server-sent events: `message`, `read`, `typing`, `conversation`                    |
| `GET /api/messaging/admin/reported`                                      | The reported first messages, for operators                                         |

Removed: under `/api/talent`, the enquiry, sent and reported-enquiry paths. The exact contract is `openapi.yml`.

## Web

| Where                      | What                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/workspace/messages`      | Messages: the lists, the open conversation, and what it is about; on a phone the list and the conversation take turns. `?c=` the conversation, `?to=&at=` a first message |
| The account menu           | Messages, with what waits; it replaces "Messages you sent"                                                                                                                |
| `/talent/[slug]`           | Contact leads to Messages                                                                                                                                                 |
| `/solutions/[slug]`        | Contact leads to Messages                                                                                                                                                 |
| `/programs/[slug]`         | "Ask GenAI Fund" leads to Messages                                                                                                                                        |
| `/admin/messages/reported` | The reported first messages                                                                                                                                               |

Removed: `/workspace/talent/sent`, the Enquiries tab of `/workspace/talent`, `/admin/talent/reported`.

The screen is composed from the registry's chat parts (`MessageScroller`, `Message`, `Bubble`, `Marker`), `Item`, `Tabs`, `InputGroup`, `Sheet` and `Empty`; nothing is drawn by hand.

## Data

- `V89__messaging_create_conversations.sql`: `messaging_conversation` (the subject, the two sides, the status, when the last message was written), `messaging_message` (a `seq` that orders every message) and `messaging_read` (how far each account read, and whether it was emailed).
- `V90__messaging_move_enquiries.sql`: every `talent_enquiry` with a text becomes a conversation with that text as its first message and its status kept. Where one sender had several that waited or were accepted with the same profile, they become one conversation holding every text in the order written; it is open when any of them was accepted, since the two sides had agreed to talk, and what was written after that acceptance is unread. The table is then dropped, with the operators' wording of the emails that are gone. Checked by hand on a throwaway PostgreSQL with enquiries of every status ([verification](verification.md)).
- **Lost in the move**, accepted on 13 October 2026 by the member who directs BEY-173 ([persistence](../../../guidelines/persistence.md#schema-evolution)): an enquiry's topic and the name its sender signed it with, which a conversation has no use for; the answer of a row folded into another, beyond the acceptance that opened the conversation; what a text held beyond 2000 characters.
- **Old requests and the clock.** An enquiry closed after fourteen days as a request does, so a moved one keeps its time and its reminder. There are no introduction requests to move: BEY-172 dropped their table, which was empty in every environment.

## Emails

Six kinds, in the group Messages: `message_request`, `message_request_reminder`, `message_request_accepted`, `message_request_declined`, `message_request_closed`, `message_unread`. The five kinds of the enquiry flow are removed; emails already sent stay in the log under their old kind.

## Known limits

- The events stay inside one instance, as matching's do: with two instances a person would hear only what was written through their own. The clock could also remind twice.
- A screen that is open while its person joins or leaves an organization hears the change within ten minutes, when its stream is opened again.
- The count in the account menu is read when a page is rendered; it does not move while a person stays on one page outside Messages.
- GenAI Fund's operators are not emailed about messages, and a person cannot be written to by GenAI Fund first.
- No attachments, no editing or deleting of a message, no blocking of a sender beyond declining and reporting.
- Each of a person's two lists shows the 200 conversations written in last, with no further page; the counts in the account menu count them all. GenAI Fund's operators share every program conversation and would reach that first.
- The limits of ten conversations a day and thirty messages a minute are counted under a lock for the account, so requests sent at once do not pass them; two messages written at the same instant in one conversation may still be kept out of the order of their `seq` for a moment.
