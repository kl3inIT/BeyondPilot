# Required-only organization popup

Accepted on 14 October 2026, replacing the earlier separate organization team-background input.

The proposal wizard's creation popup exposes only the required facts for the selected type:

| Type      | Required fields                                                                             |
| --------- | ------------------------------------------------------------------------------------------- |
| Just me   | Name, country                                                                               |
| A team    | Organization name, team size, country, short description                                    |
| A company | Organization name, website, team size, industries, country, year founded, short description |

Use the existing TanStack Form fields and FormDialog, and the wizard-scoped TanStack Query reads. Switching types preserves values locally but validates and submits only active fields. A save retains optional profile data that the popup cannot edit. Teams and companies wait for review; individuals are approved at creation under BEY-189. Editing exposes only the types `typesFor` permits, does not turn an organization into an individual, and is not offered to an individual. It keeps the optimistic version check, refreshes wizard data and refreshes the route.

Extend the existing basics command with short description and company facts rather than add an endpoint. Remove the separate team-background requirement and input from organization profile forms too. Retain existing stored background and optional API data for historical compatibility; do not drop a database column or rewrite submitted proposals. Proposal-specific contextual experience is a separate existing submission field and is not redesigned by this change.

Verify schemas, per-type HTTP validation and persistence, conflict/authority protection, browser field visibility, switching, payloads, reopened versions, mobile scrolling and accessibility. Regenerate OpenAPI and the client. On 14 October the user requested pulling main, integrating it, opening a PR and merging only after all CI checks pass.

The connected Linear account cannot access BEY issues in this session; this local record remains associated with the existing BEY-133 increment.
