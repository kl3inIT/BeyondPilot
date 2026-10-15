# Messenger and Zalo: group logic and chat-box presentation

Research for BEY-173, 15 October 2026. Requested after the initial private-chat redesign. “Message” is interpreted as Facebook Messenger; this is an assumption, not a confirmed reference to Apple Messages.

## Evidence and limits

Messenger screenshots and group creation previews were returned by Mobbin MCP and visually examined. Queries for Zalo returned other apps, which were rejected as Zalo evidence. Zalo behavior is grounded in its official Help pages. Its [PC landing-page illustration](https://zalo.me/pc) was also inspected; the artwork is visibly from an older desktop version, so it establishes a general layout, not the exact current interface.

Messenger's current Help pages were not readable in this session. Consequently its present rule for exposing pre-join group history was not verified. Neither screenshots nor the 2018 announcement is sufficient evidence for that current permission rule.

## Messenger observations from Mobbin

Sources: [plain-theme direct conversation](https://mobbin.com/screens/1bbf3694-bcc1-43bc-a04d-05160bf860fb), [themed conversation](https://mobbin.com/screens/24a67bb5-608d-4a83-a569-59dc9389dcb8), [group creation flow](https://mobbin.com/flows/5c2159f0-1de4-4a17-a8bd-578559590206).

- Chats is a compact list with avatar, latest-message preview, time and a compose action at the top.
- The group flow has a separate New group sheet, group-name input, participant search, selected avatars with remove affordances, checkboxes, Cancel and Create. It opens a distinct named conversation afterward.
- The conversation header combines back navigation, a small avatar, identity and contextual actions. Calling buttons are visible in the source, but calling is not added to BeyondPilot's scope.
- Incoming bubbles are left-aligned with a small sender avatar; outgoing bubbles are right-aligned and tinted. Bubbles fit their content and have a bounded width.
- Time markers divide conversation segments. Delivery/read indicators sit near the outgoing message rather than in a separate status panel.
- The new group's initial view includes group identity, quick Add / Name / Members actions, and a muted system event showing that the group was named. The composer remains at the bottom.

These observations apply to the captured versions. The screenshot's decorative theme, stickers, reactions, voice/location sharing and call buttons are not requirements for BeyondPilot.

## Zalo behavior verified from official Help

| Topic | Observed rule and source |
| --- | --- |
| Independent group creation | Messages → plus → Create group → select people → finish. [Create a group](https://help.zalo.me/huong-dan/chuyen-muc/tro-chuyen-nhom/chat-nhom-tren-zalo/). |
| Contextual group entry | A private conversation's information panel includes Create group with this person. The group information panel exposes members and membership management. [Desktop chat utilities](https://help.zalo.me/huong-dan/chuyen-muc/nhan-tin-va-goi/nhan-tin/cac-tien-ich-co-ban-khi-nhan-tin-tren-zalo-may-tinh/). This wording distinguishes the action from adding someone directly to private history; the page does not itself prove history-copy behavior. |
| Additional members | Group options → Add members → choose people. Invitation links/QR are another supported path. [Add/invite members](https://help.zalo.me/huong-dan/chuyen-muc/tro-chuyen-nhom/moi-ban-tham-gia-nhom-chat/). |
| Group identity | Name and avatar are edited from group options; the Help article says members can change them. [Group name and avatar](https://help.zalo.me/huong-dan/chuyen-muc/tro-chuyen-nhom/huong-dan-thay-doi-hinh-nen-nhom/). BeyondPilot's owner-only settings are a deliberate difference. |
| Historical visibility | Leaders/deputies can disable old-message visibility for new members; enabling it again exposes history to all members. Leaders/deputies retain historical access. Calendar/board items such as pinned messages remain visible even when old chat messages are blocked. [History access](https://help.zalo.me/huong-dan/chuyen-muc/tro-chuyen-nhom/chan-thanh-vien-moi/). |
| Message state | Sending/sent, received and read are different states. Read status may be disabled by the recipient. [Message delivery states](https://help.zalo.me/huong-dan/chuyen-muc/nhan-tin-va-goi/nhan-tin/gui-tin-nhan-mien-phi/). |

The PC illustration shows a list, a central message area, named group senders, a bottom composer, and a separate options/context column. Modern placement and spacing must still be derived from BeyondPilot's current components.

## Application to BeyondPilot

Retain the accepted organization-owner restrictions and independent private/group histories. Reference apps inform the interaction, not the access policy.

- Header: group avatar/name, participant count and organization context; one action opens group information. Private chat states its owner-only audience.
- History: received on the left, sent on the right; group senders carry name and organization; dates and system events are muted inline rows. Do not render a large card around every message or repeat a page-size heading above the thread.
- Composer: within the visible chat viewport on desktop and 390 × 844 mobile, below the scrollable history. A future implementation must not claim received delivery unless it can actually observe that state.
- Information: membership, group name and avatar editing, and leaving belong in group information. The private chat offers Create separate group.
- New members: a visible joined marker and only post-join messages. Zalo's configurable retrospective visibility and pinned-item exceptions are not adopted. BeyondPilot has no history-sharing toggle in this design.

The reference study does not add calls, attachment storage, message forwarding, reactions, public invitation links or arbitrary third-organization groups.
