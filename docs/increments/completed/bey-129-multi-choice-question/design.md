# BEY-129 — a program question answered by several choices

> **Completed, 14 October 2026:** delivered and running on staging and production (release 372f259b). What it left open is on its Linear issue.

Status: implemented and tested ([plan](plan.md)); not yet on staging. The contract that results is in the [program](../../../specs/program.md#application-window-and-questions) and [proposal](../../../specs/proposal.md#the-working-copy) specifications and its checks in their test matrices ([program](../../../tests/program.md), [proposal](../../../tests/proposal.md)).

## Why

The AI for Insurance Challenge × Tasco is moving from GenAI Fund's earlier page to BeyondPilot. Its form asks for "challenge areas": several among eight options. A program's questions ([BEY-29](../bey-29-program/), [BEY-37](../bey-37-proposal/)) were `short_text`, `long_text`, `single_choice`, `file`, `link` and `confirm`, and none takes several choices. The applications already submitted on the earlier page carry that answer and are to be imported later, so the answer has to be storable and readable here.

## Outcome

- **A seventh kind, `multi_choice`.** It has options as `single_choice` has: two to twenty, stripped, distinct. `V74__program_question_multi_choice.sql` widens `program_question_kind_check`.
- **Its answer** is one or more of the question's options, each exactly as written and once. A required question needs at least one.
- **Admin › Programs › Questions** offers "Several choices" beside "One choice", with the same editor of choices.
- **The application form** shows the question as a named group of checkboxes, saved by the form's autosave.
- **Every screen that reads an application back** shows the chosen options, one a line.

No module boundary changes, no new error code, and no change to when a program's questions are fixed.

## Decisions

### The answer is text: a JSON array of the options chosen

`answers` is a map from a question's identifier to text, everywhere it exists: `SaveApplicationRequest.answers` (`Map<UUID, String>`), the `answers` column of `proposal` (read as `Map<String, String>`), `ApplicationResponse.answers`, and the `value` of an answer in a version's snapshot and in `ReviewApplicationResponse.Answer`. The question's kind says how the text is read: a file's identifier, `true` for a confirmation, an option for one choice.

A `multi_choice` answer follows that model. It is the text of a JSON array, `["Claims","Pricing"]`, so the stored row holds `{"<question id>": "[\"Claims\",\"Pricing\"]"}`.

- **Why not a JSON array as the value.** `{"<question id>": ["Claims","Pricing"]}` reads better in the database, but it changes the type of every `answers` there is: the request, the response, the snapshot and the review record would each become "text or a list", every reader in the backend and the web would have to tell them apart, and a build from before this change could no longer read a row that holds one. Nothing that exists would read differently under the chosen shape: every answer already stored is text and stays text.
- **Why JSON and not a separator.** An option is any text of up to 160 characters, so a comma or a line break may be part of one. A JSON array has no such limit and both sides already read it.
- **One spelling.** The backend keeps the options in the order the question offers them, whatever order the form sent, so the same choice is always the same text.
- **Nothing chosen is no answer.** The form sends no answer when no box is ticked, as it sends none for an empty text. An empty list is refused rather than read as "no answer", so the stored text never says "answered" with nothing in it, and the submission's check of required questions needed no change.
- **A limit that follows.** An answer is at most 4000 characters in the request. Twenty options of 160 characters are 3261 as a JSON array, so every list of ordinary options fits; one whose options are mostly quotation marks or backslashes, which JSON writes as two characters, could pass the limit and be refused as `REQUEST_INVALID`.

### The first one-choice question still heads the list

The list of a program's applications and its CSV show and filter by the answer to the program's first `single_choice` question (`ReviewHeadResponse.choice`). A `multi_choice` answer is not offered there: a filter over several values is a different control, and nothing asked for it. It is read on the application.

### Checkboxes from the installed primitives

The group is the registry's field set: `FieldSet` with a `FieldLegend` for the question, the help as its description, and one `Field` with a `Checkbox` and its `FieldLabel` for each option. No primitive was added. The read-back puts one option on a line, since an option may hold a comma.

## Where an answer is read

| Place                                                                 | Code                                                 | Reads `multi_choice`                      |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| Applicant: step "Review and submit"                                   | `web/src/features/apply/apply-flow.tsx`              | Yes, one a line                           |
| Applicant: an application's page ("View my application")              | `web/src/features/apply/application-summary.tsx`     | Yes, one a line                           |
| Operator: Admin › Programs › Applications › an application            | `web/src/features/review/submitted-record.tsx`       | Yes, one a line                           |
| Judge: Reviews › an application                                       | the same component                                   | Yes, one a line                           |
| Operator: the list of applications and its CSV                        | `ReviewService.applications`, `ReviewService.export` | No: first `single_choice` only, see above |
| The email to the applicant after a submission, and the outcome emails | `notification` templates                             | They list no answers                      |
| MCP: a program's applications                                         | `ReviewService.applicationsOf`                       | It carries no answers                     |

## Not done here

- No program's questions were added or changed in any database, and nothing was imported.
- The import of the applications submitted on the earlier page is its own work; it writes the answer in the shape above.
