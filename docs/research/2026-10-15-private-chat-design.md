# Private chat: existing BeyondPilot layouts and Mobbin references

Research for BEY-173, read through Figwright and Mobbin MCP on 15 October 2026. This is design evidence, not a claim about deployed behavior or the other products' access-control rules.

## Existing BeyondPilot baseline

Inspected and exported the following frames from BeyondPilot — Product UI, Screens:

- `702:53185`: Messages desktop, with one continuous three-pane shell, compact conversation rows, subject information, writer identity, message timestamps and an inline composer.
- `702:54292`: Mobile thread, with back navigation and the composer below the message history.
- `702:54092`: Mobile conversation list with search, Chats / Requests tabs, latest-message previews and an unread badge.
- `640:53351`: The established workspace talent profile layout.

The existing shell, native MessageBubble instances and spacing are a closer fit than the separate oversized cards used in the first group-chat proposal. The old example lets all organization members read; that sample copy and employee sender must not be carried into the new owner-only private chat.

## Mobbin screens actually inspected

The MCP returned inline screenshots, which were saved locally and visually examined before drawing conclusions.

| Reference | Observation | Application to BeyondPilot |
| --- | --- | --- |
| [Campsite Messages](https://mobbin.com/screens/cc879b6a-a0ce-4de7-acb5-1bb9c5e334ac) | Compact list next to the thread, latest-message preview, a small create action in the list heading, and conversation tools in the thread header. | Put Create group beside Messages, retain preview/unread rows, and keep the conversation header compact. |
| [Whop: creating a group](https://mobbin.com/flows/40694b2d-1ed3-46fa-bcad-ec8745d94ad4), preview screens 1, 5 and 8 | A modal keeps the inbox in context; selected people and search appear inside it. Group information is a separate side panel with rename, add-user and leave actions. | Use a dialog/sheet for group creation. Keep avatar/name/membership tools in group information. BeyondPilot still limits each owner to their own organization's members. |
| [X direct conversation](https://mobbin.com/screens/2d55fb20-142e-4ffd-9b1a-d44474448acd) | Small header, aligned incoming/outgoing bubbles, message timestamps, and a composer at the bottom. | Use the existing BeyondPilot message components with bounded bubble width; preserve the mobile conversation viewport. |
| [Substack direct conversation](https://mobbin.com/screens/4510eb05-7ff6-4246-a149-ea1ff2d13bcf) | Back navigation and recipient identity share a compact top bar; the composer remains near the bottom. | Separate mobile list and thread; open organization/context information as a separate view. |
| [Slack conversation/thread](https://mobbin.com/screens/a75259f0-5647-442e-8f56-593892613645) | Sender labels and contextual discussion are readable within a multi-pane workspace. | Retain sender identity and context without adding Slack's channels, files, reactions or calls to this scope. |
| [ClickUp discussion/thread](https://mobbin.com/screens/9aeb98eb-473c-4ce9-bdcc-90bd9fc36ae5) | The main discussion, secondary context and composer have distinct regions. | Keep one continuous shell with separators rather than a stack of unrelated cards. |

These screenshots establish visual patterns only. They do not establish how any reference product grants history access or checks organization ownership.

## Decisions for the revision

1. Reuse the existing BeyondPilot three-pane desktop shell and two-pane tablet shell. Mobile uses separate list/thread/information screens.
2. Keep private chat identity and organization context visible. A compact access notice says that only organization owners read the private chat.
3. The employee shown in the old sample is replaced by the recipient owner. Team collaboration begins in a separate group with a fresh history.
4. Provide Create group in the Messages toolbar and a contextual Create separate group action in conversation information. Do not expose Add member inside the private chat.
5. Retain BeyondPilot's tokens, Inter styles, pill buttons, native headers, Input, Avatar, Badge and MessageBubble instances. Reference applications supply interaction patterns, not replacement branding.

The simpler baseline was the existing Messages layout; it is retained. The difference is the explicit private/group distinction and a group-creation entry point. New calling, attachments, reactions, channels or public user discovery are not inferred from the references.
