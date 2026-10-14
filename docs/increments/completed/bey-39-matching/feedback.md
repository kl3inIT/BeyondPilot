# Matching: people say whether the AI put a solution in the right group

Part of [the matching design](design.md). Tracked in Linear as BEY-106. Asked for by Đạt on 10 October 2026.

## Why

Nobody knows whether matching judges well. Measured on 9 October: the same answer in 33 of 36 reruns, and every quote found in the vendor's material. Not measured: whether the groups are the ones a person who knows the industry would choose. On the page a reader can only save a solution or say it is not a fit; nothing says "this belongs higher" or "the AI read this requirement wrongly", so the people who know leave no trace of what they know.

## Domain story

1. A member of the use case's organization, or an operator, reads a matched solution in its panel.
2. They answer one question: is this the right group? **Yes**, or **No** with the group it belongs in, optionally the requirements the AI judged wrongly, optionally a note.
3. The answer is kept with who gave it, when, and which judgment it is about.
4. The solution is judged again later from other material: the question is asked again, and the earlier answer stays as history.
5. An operator opens Admin › AI › Matching and reads how often people agreed with the AI, and each disagreement with a link to the solution in its use case.

## Glossary

| Term | Meaning |
| --- | --- |
| Feedback | One person's answer about one judgment of one candidate: agrees or not, the group they expected, the requirements they dispute, a note |
| Expected group | `direct`, `industry`, `technology` or `none`, the same names the code gives a judgment |
| Judgment | What a run kept for a candidate; it is told apart by its fingerprint (prompt version, requirements, sources) |

## Decisions

| Decision | Why |
| --- | --- |
| Feedback changes nothing in the list: neither the group nor the order | A group is decided by code from findings that can be tested; one person's view moving a row would make the list differ by who looked. Saving and removing stay the way a person acts on a solution |
| One question per solution, in the panel, and the details only after "No" | The page is already called wordy. A control per requirement would add up to nine more controls to a panel |
| An answer belongs to a judgment, by its fingerprint | A solution judged again from other material is a different judgment; an old "wrong" must not stand against it |
| A person has one current answer per judgment; answering again adds a row and the last one counts | Decisions on candidates work the same way: only added, never edited |
| A member reads their own answer; operators read all | It is a measure for GenAI Fund. A colleague's view shown on the row would read as a second verdict beside the AI's |
| "Not a fit" stays a decision of its own and is not counted as feedback | Removing has reasons that say nothing about the AI ("listed twice", "company closed") |
| Kept in `matching`, in a table of its own, not audited | It decides nothing and changes no state another module reads. The table is the record |
| The summary is in a tab of its own on Admin › AI › Matching | A form that is saved and a list that is read are two tasks |

## Data

`matching_feedback` (new migration, next free number): `id`, `candidate_id` (references `matching_candidate`, cascade), `account_id`, `fingerprint` (the judgment's, as stored on the candidate when the answer was given), `ai_bucket` (the group the AI had given), `agrees` boolean, `expected_bucket` (null when `agrees`; `direct`, `industry`, `technology` or `none`; never equal to `ai_bucket`), `requirements` (integer array of the positions disputed; empty by default), `note` (up to 500 characters, null when empty), `created_at`. Index on `(candidate_id, account_id, created_at desc)` and on `created_at`.

Invariants, owned by `MatchingService`: only a judged candidate takes feedback; `agrees = false` needs an expected group other than the AI's; disputed requirements are positions of the use case's requirements.

## HTTP, under `/api/matching`

| Request | Who | What |
| --- | --- | --- |
| `POST /candidates/{id}/feedback` `{agrees, expectedBucket?, requirements?, note?}` | Member of the use case's organization, operator | Keeps the answer; answers the whole state, as the other decisions do |
| `GET /use-cases/{id}` | as today | `Candidate` gains `feedback`: the caller's current answer about the current judgment, absent when none. For an operator, also `feedbackCount` and `disagreeCount` of everyone's current answers |
| `GET /admin/feedback?page=` | Operator | Totals over the last 30 days (answers, agreements) and a page of disagreements: use case, solution, the AI's group, the expected group, the requirements disputed, the note, who and when |

A candidate that is not the caller's reads as `MATCHING_CANDIDATE_NOT_FOUND`, as for the other decisions. A change is told on the stream as `decision`.

## Screens

- **Panel**, under the evidence and above the two decisions: "Is this the right group?" with **Yes** and **No**. After Yes: "You agreed." with **Change**. After No, in place: the four groups as choices (the AI's own left out), "Which requirement did the AI get wrong?" as optional checkboxes when the use case has more than one requirement, a note (optional, 500), **Send** and **Cancel**. After sending: "You said: Strong fit." with **Change**. English and Vietnamese; 44px targets on touch; nothing here moves the row.
- **Operator's panel** adds one line when others answered: "3 answers, 1 disagrees".
- **Admin › AI › Matching**, a second tab, Feedback, beside Limits: answers and agreement over 30 days, then the disagreements as a table that becomes cards on a phone, each linking to the use case's matched solutions with that solution open. Empty state: "Nobody has answered yet."

## Left out

- Using the answers to change a group, the order or the prompt.
- Feedback on a solution the list does not show (one that fits no group): an operator adds it by hand, which is already kept.
- Showing a colleague's answer to members.

## Plan

| # | Step |
| --- | --- |
| 1 | This design in the repository; `docs/specs/matching.md` and `docs/tests/matching.md` updated with the change |
| 2 | Migration, repository, `MatchingService.feedback`, the two reads; tests at the repository and over HTTP (member, stranger, operator, not judged, same group refused, a new judgment asks again) |
| 3 | `openapi.yml` and the generated web client |
| 4 | The panel's question, with the stub and browser tests (answer Yes, answer No with a group, change, axe on desktop and phone) |
| 5 | The Feedback tab of Admin › AI › Matching, with its browser test |

## Verification

- `MatchingRepositoryTest`: the last answer counts; an answer about an earlier fingerprint is not the current one.
- `MatchingRunTest` over HTTP: the cases of step 2; the totals and the page of disagreements.
- `matching.spec.ts` and the settings spec: steps 4 and 5.
- On staging after the merge: one answer given as the operator, read back on Admin › AI › Matching.
