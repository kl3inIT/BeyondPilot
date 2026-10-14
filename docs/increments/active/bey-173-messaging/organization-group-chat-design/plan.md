# Figma delivery plan

- [x] Inspect the connected BeyondPilot file and existing components/tokens.
- [x] Create a separate proposal section with desktop (1440), tablet (1024), and mobile (390) states.
- [x] Link the creation, acceptance and group management prototype paths.
- [x] Export representative frames and inspect layout, responsive behavior and privacy copy.
- [x] Check Vietnamese copy on creation, membership selection and group information.
- [x] Record node IDs and verification evidence below.

This increment contains design work only. Production API, data migrations and client behavior remain implementation work requiring a subsequent scope decision.

## Delivery — 15 October 2026

File: **BeyondPilot — Product UI**. Page: **Screens**. Section: **Messages — Private chats & organization groups (design proposal)**, node `772:57034`.

There are 54 frames: 17 English states at each of the three viewport widths, and three Vietnamese mobile copy checks. The existing deployed-reference sections were retained.

| Review entry | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Private conversation / Create group shortcut | `772:57035` | `773:57111` | `773:57187` |
| Create group | `773:57233` | `773:57320` | `773:57407` |
| Accept group invitation | `773:57652` | `773:57723` | `773:57794` |
| Group conversation | `773:57857` | `773:57936` | `773:58015` |
| Group information | `773:58064` | `773:58144` | `773:58224` |
| Add members | `773:58296` | `773:58361` | `773:58426` |
| Edit name and avatar | `773:58483` | `773:58537` | `773:58591` |
| New participant's visible history | `773:58637` | `773:58713` | `773:58789` |
| Ordinary member's group information | `773:59140` | `773:59217` | `773:59294` |

Vietnamese creation, member selection and group information are `773:60275`, `774:60354` and `774:60411`. Messages list and invitation flows have named prototype starting points. Private chat → Create group and group → Information → Add members / Edit have navigation links. Post-add screens retain the owner perspective; the new participant's limited history is a separate starting point.

### Verification

- Read all 54 frames back through Figwright: viewport widths match their labels, screen content stays inside the frame, and direct Button instances have at least 40px height.
- Exported desktop/tablet core flows and all mobile states. Visually inspected private chat, creation, invitation, group, name/avatar editing, new-member history, and Vietnamese creation/information.
- Read key prototype reactions explicitly with `get_reactions`, including the ordinary-member restriction. `get_node` does not include reactions in this plugin version.
- Non-owner creation is disabled; the member prototype returns to the member's Messages view and cannot use that view to enter the owner-only private conversation.
- Reused existing SiteHeader, Button, Input, Checkbox and Avatar instances, inherited Inter text styles, and Theme/Scale variable bindings.

The prototype uses fixed sample values. Search, changing checkbox selections, native image selection and message sending are not simulated as application behavior. The creation form shows its ready-to-submit state; a future implementation must provide empty, pending and validation states.

### Tooling note

Figwright 0.6.0 required local development-plugin fixes: resolve local variables before remote lookup, and replace uniform-font text directly while retaining the original path for mixed text. These fixes avoid connection errors and stalled text updates in this file. The original plugin bundle was backed up locally; neither plugin bundle nor design helper scripts are committed.
