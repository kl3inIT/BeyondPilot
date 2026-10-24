# Use case member access

Who may do what with one use case, set per use case and per person.

- Roles: viewer, editor, full access. The creator, the organization owners and GenAI Fund operators always have full access.
- `use_case.member_access` holds what every other member of the organization may do (none, viewer, editor, full access). Existing use cases keep full access for members, so nothing changes for them; use cases members start default to none.
- `use_case_access` holds the roles given to single people.
- A public use case is readable by every member of the organization.
- Viewer reads; editor also saves changes; full access also requests to publish, pulls back, makes private or public, and changes the list.
- Changes to the list are audited (`use_case.access_set`, `use_case.access_remove`, `use_case.access_general`).
- The list is shown and changed on the Member access tab, in the workspace and in the admin area.
