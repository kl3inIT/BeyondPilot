# Messaging

The conversations people have on BeyondPilot: with the person behind a talent profile, with the organization that offers a solution, and with GenAI Fund about a program. Designed in [BEY-173](../increments/active/bey-173-messaging/design.md) and decided in [ADR 0008](../decisions/0008-a-messaging-module-carries-conversations.md). This page says what exists.

## Module

- **`messaging` is a closed module** that depends on `audit`, `identity`, `notification`, `organization`, `program`, `solution` and `talent`. Nothing depends on it. `MessagingService` is what people use; `MessagingAdministration` is what operators read.
- **It owns** `messaging_conversation`, `messaging_message` and `messaging_read` (V90), and `messaging_participant` (V97). V91 moved the talent enquiries into them and dropped their table. V97 also records which side wrote each message and the operator a program conversation is assigned to (`program_assignee_account_id`).
- **It reads** the person behind a listed profile and the profile as its page says it (`TalentDirectory.recipient`, `indexed`), the approved solution at an address and its page (`SolutionDirectory.approvedAt`, `indexed`), the published program at an address (`ProgramService.named`, `names`), a person's organization, an organization's owners, members and name (`OrganizationDirectory`), people and who is an operator (`IdentityService`).
- **HTTP** is `messaging.web`: `MessagingController` at `/api/messaging` and `AdminMessagingController` at `/api/messaging/admin`. Every path needs a session.

## A conversation

- **Its subject** is one talent profile, one solution or one program, and the kind says which. The name the subject had when the conversation started is kept, and shown once its page is gone.
- **Its two sides.** A talent or program conversation starts with the account that wrote first. A solution conversation starts with its approved organization, and only an owner may start it. Its other side is the person behind the talent profile, the organization that offers the solution, or one assigned GenAI Fund operator for a program. For either organization side, current owners can read and write; a current member can read and write only after an owner of that organization adds them to this conversation. The initiating account has no special access once they cease to be an owner or invited member. Access is checked on each request.
- **One for a starter and a subject** while it is `pending` or `accepted`: personal conversations have a partial unique index by starter account and subject. A solution conversation is found by starter organization and solution; owners serialize starts for that pair, so another owner continues the existing conversation.
- **A profile its person deletes** takes its conversations with it (`on delete cascade`). An organization merged into another gives its conversations to the one kept, in the merge's transaction.

## Starting one

- **To a talent profile:** any signed-in person, never the person behind it. The profile must be approved and listed.
- **To a solution:** an owner of an approved organization, never of the one that offers it. The solution must be approved; one its owners keep out of the directory is still written to by its address.
- **To a program:** any signed-in person who is not an operator. The program must be published.
- **The lists.** Each of the caller's two lists holds the 200 conversations written in last; there is no further page.
- **A first message** is 1 to 2000 characters after trimming and carries an identifier chosen by the sender. Retrying with the same identifier and text returns the conversation without writing or emailing again. To a profile or a solution the conversation starts `pending` and the people who answer are emailed (`message_request`) with the sender's name and organization and what it is about, never an address and never the text, which is read in Messages only. To a program it starts `accepted` and nobody is emailed.
- **Limits.** Ten conversations a starter in 24 hours, then `429` with `Retry-After`. While a request waits, a second first message to the same subject is refused.

## A request

- **Who sees it.** For a talent request, the starter and the person behind the profile. For a solution request, the owners and invited current members of both organizations: the starter side under chats and the recipient side under requests.
- **Reading before an answer** tells the starter nothing: a pending request has no read mark or read event. Accepting it marks its first message read for the person who accepted.
- **Who answers.** The person behind the profile; for an organization, an owner. An invited member can read a request but cannot accept, decline or report it.
- **Accept** opens the conversation, marks it read for whoever accepted, and emails the starter (`message_request_accepted`). **Decline** and **report** email the starter the same words (`message_request_declined`); the conversation is then gone for the side that answered, and reads `declined` to the starter whichever it was. Each answer is an audit event (`messaging.request_accept`, `request_decline`, `request_report`) and is given once: the row is locked, and a second answer is refused.
- **The clock** (`MessagingClock`, every hour) reminds the people who answer once, seven days after the request (`message_request_reminder`), and closes it after fourteen, which the starter is told (`message_request_closed`). A closed request reads `closed` to the starter and is gone for the other side. The starter may write again after a decline or a close.

## Messages

- **Only an `accepted` conversation is written in**, by anyone on either side.
- **The sender chooses the message's identifier.** The same identifier sent again writes nothing and answers the message as kept; an identifier that belongs to another conversation or another sender is refused.
- **Order.** `seq` is one sequence over all messages; a later message has a greater one. A page is 50 messages: the latest, those before a `seq`, or those after one.
- **Limits.** A message is 1 to 2000 characters and holds something other than spaces, in any script. A person writes 30 messages a minute, then `429`. An account's writes wait for each other, so the limits hold for requests sent at once.
- **Read.** Each account has its own mark in each conversation, the `seq` of the last message it read; it never moves back, and a mark past the conversation's last message is refused. Only an `accepted` conversation is marked: reading a request records nothing and tells nobody, so its sender does not learn that it was read. Writing a message marks the conversation read for its writer. Each message stores which organization side wrote it; unread counts only what the other side wrote after the account's mark.
- **How far the other side read** is the furthest mark on that side: the starter's, or the furthest among the people written to.

## What a screen hears

`GET /api/messaging/events` is a stream of server-sent events for the caller.

| Event          | When                                                 | Body                                                                                       |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `message`      | A message was written                                | `conversationId`, `message` as the listener reads it (`mine` is theirs)                    |
| `read`         | Someone marked how far they read                     | `conversationId`, `seq`, `fromStarter` (which side read), `mine` (the listener, elsewhere) |
| `typing`       | Someone else in an open conversation says they write | `conversationId`, `fromStarter`, `name` when they have one                                 |
| `conversation` | One started, was answered, or closed                 | `conversationId`: the lists, and the conversation when open, are read again                |

- An event reaches the account on a personal side, current owners and invited current members on an organization side, and the assigned active operator for a program. An owner removing a member sends that member only a conversation-changed event so their open screen can close it.
- It is told after the transaction commits; a change that rolls back tells nothing. Nothing is kept for a screen that was not listening.
- The response forbids transforming it (`Cache-Control: no-store, no-transform`, `X-Accel-Buffering: no`): a proxy that compresses or buffers the stream holds every event back.
- A comment line leaves when the stream opens and every 20 seconds. The server ends the stream after ten minutes; the browser opens it again.
- The events stay inside the instance (`MessagingChanges`).

## Email to a person who is away

When a message is written, each account of the other side that has no stream open on this instance is emailed that a message waits (`message_unread`), without its text, unless it was emailed already since it last read. Marking the conversation read lets the next one be told. Operators are never emailed.

## Organization participants

An owner of either organization in an open or waiting solution conversation sees their organization's members in the conversation details. `POST /api/messaging/conversations/{id}/members/{accountId}` adds a current member to that owner's organization side. `DELETE` at the same path removes the grant; owners retain access regardless of grants. A grant has no effect after the person leaves the organization. Existing conversations have no grants on migration, so only their current owners initially see them. The owner can add a member again later; a current member without a grant gets the same `404` for direct conversation paths as a stranger.

## What operators read

Operators can read program conversations assigned to them. Reported requests retain their status and audit event but have no administration page or content-reading API. Other customer conversations remain restricted to their participants. No email carries the text of a message, so the email log holds none.

## Web

`/workspace/messages` (`web/src/features/messaging`). The page reads the lists, the conversation `?c=` names and the prospect `?to=&at=` names on the server; the screen then keeps them current from the stream, follows `?c=` through browser history, and reads the lists and the messages after the last one it holds whenever the stream opens. A message the reader sends is shown at once under an identifier the screen chose, and says so when it did not arrive. The first message keeps its identifier across retries. A speech-bubble icon between the language selector and account avatar opens Messages. Its badge shows unread messages and waiting requests together, and "99+" above 99 (a screen reader hears the whole number). The browser reads the count (`GET /api/messaging/unread`) once the header is on screen, then every minute while the page is visible and whenever the window regains focus or the tab becomes visible; the server render never waits for it. It is read on a timer rather than over the stream, which would hold a connection open on every page. A failed read keeps the last known count. Messages and its notification mark are removed from the account menu.

## Program conversation assignment

Program messages are open immediately for their sender. An operator can read or answer only after an operator assigns that conversation to them in Admin → Chat assignments (BeyondPilot has two roles, `user` and `operator`). The assignments page shows metadata (program, creation time and assignee) without sender details or message content. Assigning another operator revokes the previous operator’s access, including live events. Assignment is audited. Existing conversations become unassigned when this capability is deployed. The queue lists up to 100 conversations with unassigned conversations first.
