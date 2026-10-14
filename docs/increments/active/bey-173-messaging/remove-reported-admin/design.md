# Remove reported-message administration

The user requested removing the admin reported-message screen and its ability to read reported content, while retaining program chat assignment under the shorter name **Chat assignments** (**Phân công chat**).

Remove the reported-message route, navigation item, API, DTOs, repository reads and client queries. Keep customer reporting, its stored status and audit event: reporting still behaves like declining to the sender. System operators receive no separate access to reported content. Keep program assignment behavior and URL unchanged, and group messaging audit actions under the remaining chat assignment destination.

Verification covers the removed endpoint returning 404 to an operator, preserved reporting semantics, remaining assignment access, navigation and localized labels. Refresh the OpenAPI contract and generated client in the same change.

## Figma synchronization

The Screens section `758:59346` is now **Admin — Chat assignments (BEY-173)**. The obsolete reported-message section `750:56747` and the three reports frames in the combined Messages section were removed. The remaining assignment frames have no Reports/Assignments tabs and use the current title, lead and metadata-only table. The AdminSidebar component uses the Chat assignments label and existing Lucide Mail icon.

Verified exported renders: desktop `758:59575` (1440), tablet `758:60042` (1024), mobile `758:60510` (390), operator picker `760:60764` (1440), and Vietnamese `765:61303` (1440). The mobile table retains horizontal overflow; its title appears in the top bar, as in the web component. Existing component instances and token bindings were preserved.

## CI regressions after merging main

Run `38531867666` failed in `SearchDocumentRepositoryTest.theLastWordIsFoundWhileItIsTyped`: its stdout records the background startup repair rebuilding the index during the test, removing its synthetic document. An initial fix isolated that test with a mock. The subsequent main merge already includes the shared `IndexRepairs.awaitStartupRepair` test helper from BEY-195; this branch now reuses that fix and keeps the repair, repository and PostgreSQL real.

The same run's matching feedback browser trace shows the editing form replaced by the saved answer during a full-page screenshot, before Send was clicked. The feedback artifact now captures the question itself, preserving the viewport and the edited form. Feedback payload and result assertions are unchanged.
