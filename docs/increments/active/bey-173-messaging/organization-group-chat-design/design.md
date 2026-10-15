# Organization group chats — Figma proposal

## Scope

Design exploration for BEY-173. This proposal does not describe the deployed messaging behavior and does not authorize a backend or frontend rollout.

The client requested a Messages toolbar that can create an independent group, with group name/avatar editing and membership management. The motivation is to keep a private conversation between organization owners separate from work shared with employees.

## Proposed behavior

- A current owner of an approved organization starts a group with another approved organization. The recipient owner accepts the invitation and chooses participants from their organization.
- Each owner manages only their own organization's current members. Ordinary members cannot create groups or edit group settings; they can leave a group.
- The new group has a separate identity and an empty message history. No message from a private conversation is copied or exposed to group participants.
- A participant sees messages sent from the time they join. Rejoining does not restore earlier access. Removing a participant or leaving their organization revokes access.
- Existing private owner conversations remain separately accessible. The proposed private conversation UI offers Create group instead of adding employees to the private history.
- Group name and optional avatar appear in the conversation list and header. Owners can edit them in group information.
- System operators have no implicit access to customer groups.

## Design coverage

Messages/private conversation, group creation, pending invitation, recipient acceptance, group conversation, owner and member information, adding members, editing the group, removal confirmation, leaving, ordinary-member permissions, and the new participant's restricted history.

Desktop uses a conversation list alongside the thread. Tablet keeps the same two-pane structure. Mobile separates list, conversation and group information with explicit back navigation. Forms reflow into full-width cards.

## Implementation questions

Before implementation, define ownership transfer and how a group continues when its last owner leaves an organization. Define image upload size limits using the existing storage contract. Decide how to handle existing conversations with already granted employee access; this design cannot retroactively make previously viewed messages private.

## Design system

Reuse the file's SiteHeader, Button, Input, Checkbox, Avatar and MessageBubble instances, Inter text styles, Theme colors and Scale dimensions. Place the proposal in a separate Screens section; keep deployed reference screens intact.

## Private chat revision after reference research

The client requested a revision that follows the existing Figma format and learns from comparable applications through Mobbin MCP. The [research note](../../../../research/2026-10-15-private-chat-design.md) distinguishes screenshots observed from proposed behavior.

The revised private chat uses the native Messages shell (`702:53185` / `702:54292` / `702:54092`) rather than the original oversized conversation cards. Desktop keeps list, thread and solution/organization context in one bordered surface. Tablet moves details out of the main shell. Mobile has distinct list, thread and information views; the composer fits inside the 844px viewport. A contextual group-creation dialog retains the conversation behind it, while the mobile form occupies a full-height sheet. Avatar editing remains in group settings.

Only organization owners appear in the private conversation and reader information. The former employee sender is replaced. Private and Group labels distinguish list entries. Both Messages-level and contextual group creation remain available, and the group receives no private history.
