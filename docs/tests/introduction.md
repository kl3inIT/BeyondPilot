# Introduction: verification matrix

Boundaries follow [conventions › Testing](../conventions.md#testing). `IntroductionTest` starts the full application against PostgreSQL and speaks real HTTP, signing in through the emailed code as the identity tests do; only the SMTP server is replaced, which is how it reads the emails a request, a reply and a decline send.

| Contract                                                                                                                                 | Regression it catches                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A member of an approved organization asks about a listed solution; the provider's owners get an email with the sender and the message    | A request nobody is told of                                    |
| The email to the owners and the list of a pending request carry no address of the sender                                                 | An address shared before the provider chose to share it        |
| A person without an organization, with an unapproved one, or asking about their own organization is refused with a typed problem         | A request nobody can answer, or one to oneself                 |
| A solution that is unknown, a draft or not listed answers `404`                                                                          | An address that reveals a solution that is not public          |
| A message that is blank is refused; one person has one waiting request to a solution                                                     | Repeated mail to the same owners                               |
| A reply emails each side the other's name and address, marks the request replied and is recorded in the audit log                        | An introduction that reaches one side only, or leaves no trace |
| After a reply the sender's address shows on the list, and the same person may ask again                                                  | A conversation that cannot continue                            |
| A decline emails the sender without any address and is recorded in the audit log                                                         | A provider's address leaked by a refusal                       |
| A request is answered once; a second reply or decline is refused                                                                         | Two answers to one request                                     |
| Only an owner of the organization asked answers; another organization finds nothing at the identifier                                    | Answering, or learning of, another organization's requests     |
| An operator reads every request in full without an address, and a request waiting more than three days is marked; anyone else is refused | An address leaked to operators, or a request nobody notices    |
| Every path needs a session                                                                                                               | Anonymous requests                                             |
