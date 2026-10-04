# BEY-27 — Main flows as UI design

The Phase 1 milestone of 6 October 2026: the main flows drawn in Figma, at 1440, 1024 and 390, so GenAI Fund can review them before the screens are built. This increment changes no behavior; it fixes what the screens are, which decisions they encode and which components they need. The research behind the choices is in [research.md](research.md).

## Outcome

A person who arrives on a phone from a partner link can read a program, sign in, apply in four steps and follow the outcome. An enterprise team can browse use cases and AI solutions with proof. Every screen uses real content: the AI for Insurance Challenge × Tasco, GenAI Fund's programs and events, the use cases of GenAI Open Innovation Vietnam 2025 and the FastTrack cohort.

## Where the design lives

Figma file `BeyondPilot — Product UI`, page `Screens`, section `Main flows — 6/10`. Rows are labelled in the file; each row holds the 1440, 1024 and 390 frames and, to the right of the 390 frame, its state frames.

| Row | Screen                                                          | States drawn                                                                              |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Programs list                                                   | —                                                                                         |
| 2   | Program detail, open (AI for Insurance Challenge × Tasco)       | sticky Apply bar at 390                                                                   |
| 2b  | Program detail, ended with results (Agentic AI Build Week 2026) | —                                                                                         |
| 3   | Sign in before applying                                         | —                                                                                         |
| 3b  | Check your email (six-digit code)                               | typing, wrong code, code expired, too many wrong codes, three codes asked                 |
| 4   | Apply, step 1: you and your team                                | validation errors                                                                         |
| 5   | Apply, step 2: your solution                                    | file too large, uploading                                                                 |
| 6   | Apply, step 3: for this challenge                               | —                                                                                         |
| 7   | Apply, step 4: review and submit                                | deadline passed; answers missing (390 and 1440)                                           |
| 8   | Application submitted                                           | email not sent                                                                            |
| 9   | My applications                                                 | draft, none yet, shortlisted, not selected, draft not submitted in time, status reference |
| 10  | Application detail                                              | after the deadline, shortlisted, not selected                                             |
| 11  | Directory list, use cases                                       | —                                                                                         |
| 11b | Directory list, AI solutions; AI talent                         | empty (talent opens with the launch)                                                      |
| 12  | Use case detail                                                 | sticky proposal bar at 390                                                                |
| 13  | Solution detail                                                 | unknown evidence shown as unknown                                                         |

Above the section, `Flow map — which screen leads to which` shows the three journeys as rows of cards with their branches: applying to a program, browsing the directory, and reviewing applications. Each card names the row of its screen and opens it in Present mode. The prototype has one named flow per journey and width.

### Operator screens (BEY-28)

The section `Operator — applications (BEY-28)` holds what a GenAI Fund operator needs once applications arrive on BeyondPilot instead of the interim app. They are drawn at 1440 and 1024; the list also at 390.

| Row | Screen                                                                                                                                                   | States drawn                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| O1  | Applications of a program: status tabs, search, filters by direction and applicant kind, a table with reviews and status                                 | several selected, with bulk shortlist and "not selected" |
| O2  | Application review: the answers and files on the left; the reviewer's own assessment and private note, the other reviewers and the decision on the right | —                                                        |
| O3  | Release outcomes: the shortlisted and not-selected lists, the email each group receives, a confirmation                                                  | blocked while any application is under review            |

The rows in these tables are sample data: applications are private, and none exists in the new system yet. The operator area uses a sidebar (`AppSidebar`, full at 1440, icons at 1024) and a top bar with a breadcrumb. Still to draw, with the AI milestone: the candidate board per use case. After that: approving use cases and solutions, creating and editing a program, and the workspaces of providers and enterprises.

New components are on the page `Foundations & Components`, section `Form and flow primitives`. The pairs that exist in code are recorded in [docs/figma-component-map.md](../../../figma-component-map.md).

## Decisions

1. **Sign in before the form.** Apply leads to sign-in (Google or an emailed six-digit code, no password) and returns to step 1. The sign-in screen keeps the campaign in view: the program, its deadline and what the applicant will need. Signing in first is what lets a draft save from the first keystroke and lets "enter once, reuse everywhere" work.
2. **A solo builder applies as an individual.** Step 1 asks "Applying as": Individual, Team or Company. Individual asks for no organisation; the system keeps a hidden one-person team behind it. Team asks for a name and members; Company asks for the organisation.
3. **Four steps, named.** You and your team; Your solution; For this challenge; Review and submit. Steps 1 and 2 hold what a person and a solution keep between applications (contact details, team, what the solution does, its stage, what it is built with, the solution deck, a demo link), so the next application starts filled in. Step 3 holds the answers one program asks for: the direction, how the solution addresses the challenge, what the enterprise would need to provide, responsible design and the proposal file. The fields were reconciled on 4 October 2026 with the live application form of the interim campaign ([research](research.md#review-of-4-october-2026)). Every field is required unless it is marked Optional, and each step says so once.
4. **An application stays editable until the deadline**, including after it is submitted, as the live campaign promises ("replace your pitch deck any time before 15 Oct"). Judges see the latest version.
5. **Statuses.** Draft, Submitted, Under review, Shortlisted, Not selected. Every status has a label; colour is never the only carrier. Under review starts when the deadline passes.
6. **A program page is a campaign page with a lifecycle.** Open: a cover with the program's name, hook and proof numbers; an Apply rail that stays in view (a bar at the bottom on a phone); sections for what winning brings, the challenge, directions, timeline, eligibility, submission, judges and FAQ. Ended: the same page leads with scale numbers and the winners per track, and points to what is open now.
7. **The directory is one list template.** Search, tabs per kind (use cases, AI solutions, AI talent), a row of filters and a card grid; on a phone the filters open in a sheet. A use case card is text-first (industry, title, the need, its source). A solution card shows its logo and one line of proof.
8. **Proof before claims on a solution page.** Each proof item names its kind of evidence (programme selection, enterprise proof of concept, stated by the company) and links its source. A kind with nothing published is shown as such, never left out.
9. **Introductions go through GenAI Fund.** "Request an introduction" on a solution keeps both email addresses private until the other side replies.
10. **Review is private until release.** An operator and the invited reviewers give an assessment and a note that the applicant never sees. Outcomes are released for the whole program at once, and only when every application has a decision, so that every applicant hears back on the same day.
11. **The review step says what is missing.** When a required answer is empty, the step names it at the top, marks its section Incomplete with a Complete link, shows Missing in place of the answer, and keeps Submit disabled. The stepper shows the count beside the step.
12. **Submitting ends on a receipt.** The check sits beside the title; under it are the program, the solution, the team, the time of submission and the time editing closes, then what happens next and the two ways on. When the copy by email cannot be sent, the page says so and points to My applications.
13. **My applications is one card per application.** An applicant has one or two applications, not dozens, and comes to see where one stands. A submitted application shows the program's own stages (Submitted, Screening, Outcome, Demo day) as a bar filled up to the current one, the next step and its actions. A draft shows the step reached and the deadline. A past application shows its outcome in one line. The groups are In progress, Submitted and Past. The page keeps a column of 880px at 1440.
14. **An icon carries no tinted tile.** An icon on a tinted square, standing alone, reads as decoration; icons sit bare beside their text in cards, choice cards, upload boxes, file rows and empty states.
15. **A long results list is a table.** The ended program lists its tracks as rows (track and owner, winners, runners-up or shoutouts) and shows all of them on a phone.

## Components

Installed with the shadcn CLI and drawn in Figma with the same names: `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroupItem`, `TabsTrigger`, `Progress`, `Alert`, `Empty`. `Input` and the default `Select` trigger are 40px tall and `Textarea` starts at 96px, so a field is comfortable on a phone.

Drawn in Figma and still to be written in code, with their first screen:

| Figma component | Becomes                                                      | First used by                                       |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `ChoiceCard`    | a composite over `FieldLabel`, `Field` and `RadioGroupItem`  | Apply, step 1                                       |
| `StepItem`      | a composite for a vertical stepper and a status timeline     | Apply stepper, application detail, program timeline |
| `FileUpload`    | a composite with empty, uploading, uploaded and error states | Apply, step 2                                       |
| `ApplyHeader`   | the focused header of the application flow                   | Apply                                               |

`SiteHeader` gains a signed-in variant: an avatar with the person's initials that opens the account menu, which holds My applications and Sign out.

## Boundaries

- No behavior ships with this increment. The screens are implemented by the increments that follow (program pages, application submission, directory).
- Sample answers inside the application form ("Claim Copilot", "Pocket Policy") are sample copy, as the Figma guide allows for text in the file. Programs, dates, partners, judges, use cases, solutions and results are real and sourced in [research.md](research.md).
- The talent detail page is not drawn; talent data arrives with the v1 export.

## Open decisions

- The live form's challenge areas differ from the eight directions on the campaign page, and its files may be 25 MB where the brief says 10 MB. Both are asked in BEY-41; until answered, the screens keep the page's directions and name no size for the proposal.
- Whether an enterprise's name is shown on a use case before a provider is shortlisted (BEY-24).
- Whether the Button's tertiary prominence keeps 6px corners while the others are pills, as the landing code does.

## Verification

Each frame is checked in Figma at 1x per section for clipped text, overlaps and edge overflow at 390 and 1024, and the flow is wired as a prototype from the programs list to the submitted screen. The design critique against DESIGN.md runs before the screens are sent to GenAI Fund.
