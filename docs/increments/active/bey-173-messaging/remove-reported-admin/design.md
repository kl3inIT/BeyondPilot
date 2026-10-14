# Remove reported-message administration

The user requested removing the admin reported-message screen and its ability to read reported content, while retaining program chat assignment under the shorter name **Chat assignments** (**Phân công chat**).

Remove the reported-message route, navigation item, API, DTOs, repository reads and client queries. Keep customer reporting, its stored status and audit event: reporting still behaves like declining to the sender. System operators receive no separate access to reported content. Keep program assignment behavior and URL unchanged, and group messaging audit actions under the remaining chat assignment destination.

Verification covers the removed endpoint returning 404 to an operator, preserved reporting semantics, remaining assignment access, navigation and localized labels. Refresh the OpenAPI contract and generated client in the same change.
