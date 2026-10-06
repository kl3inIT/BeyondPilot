# Solution: verification matrix

Boundaries follow [conventions › Testing](../conventions.md#testing). Who may write a solution is read from the caller's organization on every request, so `SolutionTest` starts the full application against PostgreSQL and speaks real HTTP, signing in through the emailed code as the identity tests do.

| Contract                                                                                                                                                 | Regression it catches                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Only an owner of an approved organization creates, saves, submits and deletes; a member reads                                                            | A member or an unapproved organization publishing                   |
| A draft needs only a name; a submission needs a summary, a maturity, a focus area and an industry                                                        | An empty entry in the directory                                     |
| A stale `version` on save answers `409`                                                                                                                  | Two owners overwriting each other                                   |
| Only a draft is deleted                                                                                                                                  | A reviewed solution vanishing with its history                      |
| An operator approves a submitted solution, or rejects it with a reason; a rejected one can be submitted again                                            | A rejection without a way back                                      |
| An operator takes an approved solution down                                                                                                              | A listing GenAI Fund cannot remove                                  |
| The directory shows only approved and listed solutions, filtered by search, industry, focus area and maturity                                            | A draft, a rejected or a hidden solution shown to the public        |
| The public paths need no session; everything else does                                                                                                   | The directory behind sign-in; an editor open to visitors            |
| Each approval and rejection is in the audit log                                                                                                          | A decision nobody can trace                                         |
| The response to a submission carries the version the next save sends                                                                                     | A save right after a submission refused as stale                    |
| The directory lists by name, or the most recently approved solutions first when asked                                                                    | An order the visitor chose and did not get                          |
| The directory narrows to the solutions of one organization, by the address of its public page                                                            | Another organization's solutions on a company's page                |
| A customer deployment is read by its organization and by operators at once, and by the public only after an operator approves it                         | An unreviewed claim about a customer on a public page               |
| A change to an approved customer deployment takes it off the public pages until it is approved again; a save from a stale form is refused                | An edited claim shown without review; a silent overwrite            |
| Only an operator decides on a customer deployment, each decision is recorded in the audit trail, and only the owners of its solution change or remove it | A provider approving its own claim; another organization editing it |
