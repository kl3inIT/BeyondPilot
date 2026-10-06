# AI talent: enquiries answered by the person, review decisions and the profile of the drafts

A visitor who finds a person in the talent directory writes to them through BeyondPilot, and the two addresses are shared only when the person accepts. GenAI Fund's decisions on a profile become three distinct ones, each told by email. The profile gains the facts the screens show. Tracked in Linear as BEY-36.

It changes what [BEY-33](../bey-33-organization-solution-talent/design.md) built: its [decision 10](../bey-33-organization-solution-talent/design.md#decisions) (the enquiry is emailed with the sender's address) is replaced, and its [decision 5](../bey-33-organization-solution-talent/design.md#decisions) (an edit to an approved profile is public at once) stays. The screens are the section `AI talent — directory, profile, enquiries and review` of `BeyondPilot — Product UI`, as [BEY-27](../bey-27-main-flows-design/design.md#ai-talent-directory-profile-enquiries-and-review) records them. The decisions were agreed with the product owner on 6 October 2026.

## What a person can do

- **Contact a person.** A signed-in visitor opens a profile shown in the directory and chooses Contact. The dialog asks what it is about (a project, a role, something else) and for a message of up to 2000 characters, and names the organization the sender belongs to, if any. The profile page then says the message waits for an answer.
- **Hear of it, as the person.** The person gets an email with the sender's name, organization, topic and message, and no address. A sender who gave no name is "Someone", never their address. It tells them to sign in and answer under their talent profile › Enquiries.
- **Answer.** The person accepts, declines or reports the enquiry. On acceptance both get an email with the other's name and address. On a decline, and on a report, the sender gets an email that the person will not take it further, with no address; the sender cannot tell a report from a decline.
- **Let it close.** An enquiry nobody answers closes after 14 days, and the sender is told so. The person gets one reminder on the seventh day.
- **Hear of a decision on their profile.** The person gets an email when GenAI Fund approves the profile, asks for changes, or removes it, with the reason when there is one. A profile asked to change and a removed profile can both be corrected and sent again.
- **Delete their profile.** The person deletes it with its projects and enquiries; the audit log keeps that it happened.
- **Read reported enquiries, as an operator.** Under `/admin/talent/reported`, linked from the talent list, the enquiries that were reported, with sender, person and message.

## Boundary discovery

The enquiry stays in `talent`: it is addressed to a profile, its only reader is the person behind it, and its lifecycle ends with the person's answer.

| Question                       | `talent` after this change                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| What does it own?              | Talent profiles, their projects, their photo reference, the enquiries sent to them and their answers                      |
| Who changes its data?          | The person; operators for review; a signed-in sender; the clock, which closes and reminds                                 |
| What does it need from others? | `identity`, `notification`, `audit`, as today; `organization` for the sender's organization name; `storage` for the photo |
| What do others need from it?   | Nothing                                                                                                                   |

The new edges are `talent → organization` and `talent → storage`. Neither module depends on `talent`, so no cycle forms; `ModulithArchitectureTest` keeps listing the module.

## Decisions

1. **The person answers inside the application, as a provider does an introduction.** The same reasons as [BEY-34, decision 1](../bey-34-solution-introductions/design.md#decisions): an address travels only after the owner of it chose to share it. The email carries no link that acts.
2. **Anyone signed in may write.** A person looking for talent need not belong to an organization; when they belong to an approved one, the person reads its name.
3. **One waiting enquiry per sender and profile, and ten new ones per sender a day.** The first stops repeated messages to one person; the second stops a sender writing to the whole directory. They replace the one-a-day rule.
4. **A report reads as a decline to the sender.** It protects the person who reports. An operator reads the reported enquiries; blocking a sender is left for later.
5. **An answer is final.** An accepted, declined, reported or closed enquiry cannot change; the sender may write again.
6. **The clock is a scheduled task in `talent`.** Each hour it closes the enquiries older than 14 days and sends the seventh-day reminders, each at most once. The application runs as one instance; a second instance would need a lock, recorded as a known limit.
7. **An approved profile is shown in the directory or hidden.** There is no page reachable only by its link. Showing or hiding needs no review. A hidden profile takes no enquiry; the ones that wait keep their course.
8. **A profile marked "not available" can still be contacted.** The dialog says the person is not looking now.
9. **Three decisions by GenAI Fund.** Approve, ask for changes (`changes_requested`) to a profile that waits, remove (`removed`) an approved one. The last two need a reason from the closed list and allow a note. Each is emailed in both languages, as an organization decision is: the email says to sign in for the reason and quotes the operator's note. The audit catalog keeps `talent.reject` for the decisions recorded before.
10. **The new facts are optional.** Photo, city, languages, industries (the list the organizations use), where the person works (as stated) and the stage of each project (`prototype`, `pilot`, `in_production`, `internal_tool`). A submission still needs a headline, a bio, a role and a skill.
11. **The rate band is not public.** The person and operators read it; the public profile and directory do not.
12. **Projects are stated by the person.** Confirmation by an enterprise is left for later.
13. **The photo is the person's own upload.** It is a public file of the purpose `talent_photo`, at most 2 MB, named by one profile. A photo the profile no longer names, or the photo of a deleted profile, is removed from the store.

## HTTP

| Path                                                                   | Use                                                                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/talent/profiles/{slug}/enquiries`                           | Contact: topic and message (changed body)                                                                                                 |
| `GET /api/talent/profiles/{slug}`                                      | Adds when the caller's waiting enquiry was sent, if one waits                                                                             |
| `GET /api/talent/mine`                                                 | The person's enquiries, waiting first, with topic, status and when a waiting one closes; the sender's name and address only once accepted |
| `POST /api/talent/mine/enquiries/{id}/accept`, `…/decline`, `…/report` | The person's answer                                                                                                                       |
| `DELETE /api/talent/mine`                                              | The person deletes their profile                                                                                                          |
| `POST /api/talent/admin/profiles/{id}/request-changes`, `…/remove`     | Replace `…/reject`                                                                                                                        |
| `GET /api/talent/admin/reported-enquiries`                             | The reported enquiries, the most recently reported first                                                                                  |
| `GET /api/talent/profiles`                                             | Adds the filters `country` and `engagement`                                                                                               |

The exact contract is `openapi.yml`.

## Web

| Where               | What                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `/talent`           | Role chips, the filters for availability, what the person is open to and country, the new card         |
| `/talent/[slug]`    | The redesigned page: counts, the projects as a timeline, one Contact, the dialog (a sheet on a phone)  |
| `/workspace/talent` | Tabs Profile and Enquiries with its count; accept, decline, report; delete the profile; the new fields |
| `/admin/talent`     | Ask for changes and Remove as two decisions; the reported enquiries                                    |

## Data

- `V12__talent_enquiry_answers.sql`: `talent_enquiry` gains `topic`, `status` (`pending`, `accepted`, `declined`, `reported`, `closed`), `answered_at`, `reminded_at`, and a unique index on `(sender_account_id, profile_id)` where `status = 'pending'`. The rows that exist were emailed with the sender's address, so they become `accepted`.
- `V13__talent_profile_decisions.sql`: `talent_profile.status` gains `changes_requested` and `removed` in place of `rejected`. A rejected row may have waited for changes or been taken down, and nothing tells them apart, so each becomes `changes_requested`.
- `V14__talent_profile_facts.sql`: `talent_profile` adds `photo_file_id`, `city`, `languages`, `industries`, `works_at`; `talent_project` gains `stage`.

## Known limits

- One instance runs the clock; a second would send a reminder twice.
- Operators read reported enquiries but cannot block a sender.
- A project is never confirmed by the enterprise it names.
- The import of the talent of the old platform waits for the product owner's reading of that data.
