# BEY-133: a provider sends a proposal to a use case, and the organization reads what it received

Linear: BEY-133. Design in Figma, page Screens: "Use case — apply with a proposal (draft)" and "Use case — proposals received, organization and admin (draft)". Mobbin references are listed under [Research](#research).

## What a person can do

- **Send a proposal.** A member of an approved organization opens a published use case and chooses **Send a proposal**. Six steps follow, each with **Save and return later**: Organization, AI solutions, Your profile, Team, Proposal PDF, Review.
- **Look at it and change it after sending.** The members of the organization keep reading what they sent. They may also edit it for the number of days GenAI Fund sets for that use case (7 unless GenAI Fund says otherwise, 0 to 90), counted from the sending, and only while the use case is open. A sent proposal that was edited says so to the organization that posted the use case.
- **Read proposals.** Every member of the organization that posted the use case reads the proposals it received, in a list and one by one. Reading is all they do for now.
- **See how many.** Anyone, signed in or not, sees how many proposals a use case has received.

Out of scope, kept as screens or left out: editing a sent proposal's sender snapshot, withdrawing a sent proposal, shortlist and decline, every email, anything for operators.

## Domain story

1. A provider's member reads a published, open use case and chooses **Send a proposal**. The browser opens the form; the server makes one working copy for the provider's organization and that use case the first time something is saved.
2. **Organization.** The form shows the member's organization. An organization GenAI Fund has not approved cannot send; the form says so and offers nothing else.
3. **AI solutions.** The member chooses one or more solutions of the organization, whatever their review says (draft, in review, sent back, approved, rejected, taken down; listed or not), and writes how they solve this use case. A missing solution is created on the spot with the existing Solution flow: its name is asked in the usual dialog, which creates a draft, and the Solution editor opens in a near-full-screen dialog over the proposal. Public listing of that solution stays with the existing review by GenAI Fund; the proposal never asks for it.
4. **Your profile.** The form shows the member's own talent profile. The member fills in what a proposal needs (a headline, a role, a skill, an about text) before the step passes.
5. **Team.** The member adds people of the organization, each with a role typed by hand, and marks one of them as the primary contact.
6. **Proposal PDF.** The member uploads one PDF.
7. **Review and send.** The server checks everything again and keeps a snapshot of the sender's talent profile with the proposal. The proposal is now **sent** and counts.
8. A member of the posting organization opens the proposals of the use case and each proposal.

Failures. The use case closes while the form is open: sending is refused with the code for a closed use case. Two members of the provider organization edit the same working copy: the second save is refused until it reads the first. The sender's profile loses a required field after step 4: sending is refused. A person leaves the organization after being named on the team: sending is refused until the team is corrected.

## Glossary

| Term | Meaning | Not |
| --- | --- | --- |
| Proposal | What a provider organization sends to one use case. In code `UseCaseProposal`; tables `use_case_proposal` and `use_case_proposal_member`. | The existing table `proposal` and `ProposalService`: those are a person's **application** to a program ([BEY-37](../../completed/bey-37-proposal/design.md)). The module is named `proposal` for historical reasons. |
| Provider organization | The approved organization whose member sends the proposal. | The organization that posted the use case. |
| Posting organization | The organization that posted the use case. Its members read the proposals. | |
| Team member | A member of the provider organization named on one proposal, with a role typed for that proposal. | The organization's own member role (`owner`, `member`) and a member's job title; neither is copied. |
| Primary contact | The one team member the posting organization is told to speak to. | |
| Edit window | The time after sending during which the provider organization may still save its proposal: the days `use_case.proposal_edit_days` (set by GenAI Fund for each use case) after `sent_at`, while the use case is open. | A deadline for sending, which is the use case's close date. |
| Talent snapshot | The sender's talent profile as it was when the proposal was sent, kept with the proposal. | The live profile, which the person may change later. |

A proposal is **draft** or **sent**. A sent proposal never returns to draft in this increment; it stays sent while its organization edits it.

## Boundary discovery

**Data and invariant owner.** The `proposal` module owns the two new tables. It already owns the applications to programs; the new part shares its language of a working copy, a submission and a version, its actors (a person acting for an organization) and its transaction style, and it has no second source of truth for anything the other modules own. It stays one module instead of a new one: a second module would copy the same organization checks, file checks and locking, and the two flows never write the same table.

**Context map.** `proposal` reads, through the published root of each module:

| Module | What it is asked | New edge? |
| --- | --- | --- |
| `usecase` | `UseCaseDirectory.target(id)`: whether a use case is published and open, its title, closing time and posting organization | **Yes** |
| `talent` | `TalentSnapshots.of(accountId)`: the sender's profile and whether it has what a proposal needs | **Yes** |
| `organization` | `OrganizationDirectory.membershipOf`, `memberAccountIds`, `names` | no |
| `solution` | `SolutionDirectory.offered` (name, summary, review status; any state) | no |
| `identity` | `IdentityService.requireActive`, `people` | no |
| `storage` | `StorageService.stored`, `describe`, `download` | no |

The two new edges point from `proposal` to modules that do not depend on `proposal` (`usecase` allows `audit`, `identity`, `notification`, `organization`, `program`, `storage`; `talent` allows `audit`, `identity`, `notification`, `organization`, `storage`), so no cycle appears. `mcp` already depends on `proposal`, `usecase` and `talent`; that stays acyclic. `ModulithArchitectureTest` and the `package-info.java` of `proposal` change in this increment.

**Consequence for the count.** `usecase` cannot count proposals, because that would make it depend on `proposal`. The count is an endpoint of `proposal`, and the web joins it to the use case it shows.

## Commands, read models and invariants

Commands: save the working copy; send it. Read models: the form (use case, organization, members, working copy; the organization's solutions come from the existing Solutions read of `solution`); the proposals of a use case; one proposal; the counts of a list of use cases.

Invariants, checked on the server:

- One proposal for each provider organization and use case (unique index). An organization never proposes to its own use case.
- Saving needs a member of an **approved** organization, a use case that is published and open, and a working copy that is still a draft. The version the form read must still be current.
- Sending needs everything below, checked again at that moment:
  - at least one solution of the organization, any review state, each once, and a non-blank approach;
  - at least one team member; every one of them a member of the organization; every role non-blank; exactly one primary contact;
  - one stored PDF uploaded by the caller with the purpose `application_file`;
  - the caller's talent profile has a headline, a bio, a role and a skill (the profile's `complete`).
- A saved draft may be partial; only sending demands the above.
- A sent proposal may be saved again by the members of its organization while the use case is open and now is before `sent_at` plus the use case's `proposal_edit_days`. Such a save is checked as sending is (the same completeness and the same codes), keeps the status sent, the sender and the snapshot, keeps the `version` check, and records `edited_at`. Outside that window the save is refused with `PROPOSAL_EDIT_WINDOW_CLOSED`; with 0 days no sent proposal can be edited. Once the use case closes nobody edits, but the organization still reads what it sent.
- Sending stores the snapshot and the time in the same transaction that makes the proposal sent.

## Data

Migration `V78__proposal_create_use_case_proposals.sql` (the next free version on `main` when this was written; renumber on merge if another change took it).

```sql
create table use_case_proposal (
    id                    uuid primary key,
    use_case_id           uuid        not null references use_case (id),
    organization_id       uuid        not null references organization (id),
    created_by_account_id uuid        not null references identity_account (id),
    sent_by_account_id    uuid references identity_account (id),
    approach              text,
    deck_file_id          uuid references storage_file (id),
    status                text        not null default 'draft' check (status in ('draft', 'sent')),
    talent                jsonb check (talent is null or jsonb_typeof(talent) = 'object'),
    sent_at               timestamptz,
    edited_at             timestamptz,
    version               bigint      not null default 0,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint use_case_proposal_organization_key unique (use_case_id, organization_id)
);
create index use_case_proposal_sent_idx on use_case_proposal (use_case_id) where status = 'sent';

create table use_case_proposal_member (
    proposal_id uuid    not null references use_case_proposal (id) on delete cascade,
    account_id  uuid    not null references identity_account (id),
    position    integer not null,
    role        text    not null default '',
    is_primary  boolean not null default false,
    primary key (proposal_id, account_id)
);
create unique index use_case_proposal_primary_key on use_case_proposal_member (proposal_id) where is_primary;

-- The solutions the proposal offers; deleting a draft solution takes it off the proposals that offered it.
create table use_case_proposal_solution (
    proposal_id uuid    not null references use_case_proposal (id) on delete cascade,
    solution_id uuid    not null references solution (id) on delete cascade,
    position    integer not null,
    primary key (proposal_id, solution_id)
);
```

A second migration, `V79__usecase_add_proposal_edit_days.sql`, adds `use_case.proposal_edit_days integer not null default 7 check (proposal_edit_days between 0 and 90)`; the module `usecase` owns it, GenAI Fund sets it when it creates a use case, and the use case an organization writes itself gets the default. `UseCaseTarget` and the public use case carry it as `proposalEditDays`, so the public page can say that proposals can be edited for that many days after sending.

The snapshot is the profile without the rate band and without whether it is listed: the proposal shows what the sender chose to say about themselves, nothing the profile keeps private.

When an organization is merged ([BEY-33](../../completed/bey-33-organization-flows-and-admin/design.md)), the existing merge listener of the module also moves `use_case_proposal.organization_id`. If the kept organization already has a proposal for the same use case, the proposal of the merged one is dropped when it is a draft and kept under its former organization when it is sent; the merged organization still exists as a row, so nothing breaks.

## API

All paths are under `/api/proposal`; the operation ids are stable names for the generated client.

| Operation | Method and path | Who | Answers |
| --- | --- | --- | --- |
| `getUseCaseProposalForm` | `GET /use-cases/{useCaseId}/proposal` | signed in | The use case, the caller's organization and whether it is approved, its members, and the working copy (with the solutions it offers) or null |
| `saveUseCaseProposal` | `PUT /use-cases/{useCaseId}/proposal` | member of an approved organization | The form with the draft as saved, or with the sent proposal as edited within its edit window |
| `sendUseCaseProposal` | `POST /use-case-proposals/{id}/send` | the same | The form with the proposal sent |
| `listUseCaseProposals` | `GET /use-cases/{useCaseId}/proposals` | member of the posting organization | The sent proposals, newest first |
| `getReceivedUseCaseProposal` | `GET /use-case-proposals/{id}` | member of the posting organization | One sent proposal with its snapshot and team |
| `getUseCaseProposalFile` | `GET /use-case-proposals/{id}/file` | member of the posting organization | The PDF, saved under its name |
| `countUseCaseProposals` | `GET /use-cases/proposal-counts?useCaseIds=…` | anyone | The number of sent proposals of each use case, at most 50 ids |

The form (`getUseCaseProposalForm`) answers for the caller's sent proposal even after the use case closed or while it cannot be edited, so the organization can read it; the proposal carries `editableUntil` (the end of the edit window while the use case is open, the days are above 0 and the time has not passed, otherwise null) and `editedAt`. The proposals the posting organization reads carry `editedAt`.

The proposal the sender reads carries `sender` (the profile snapshot as sent; null for a draft). Each offered solution carries its name, summary, `logoFileId` (its own logo, else its organization's), `viewKey` and `slug` (only while it is approved and not taken down); the review status is not part of it. Every offered solution opens in a new tab: at `/solutions/{slug}` when approved, otherwise at `/solutions/shared/{viewKey}`. `viewKey` is an unguessable `solution.view_key` (migration V76); `GET /api/solution/solutions/shared/{viewKey}` is public and returns the public solution page for any status (`approved` says whether it is published), without the owners' editor fields, and is never listed or indexed (the page is `noindex, nofollow`). Anyone holding the link reads even a draft, which is the accepted trade-off. `SolutionSummary` (the owners' list) carries `logoFileId` and `viewKey` so the wizard draws the same cards.

The working copy is shared by the members of the provider organization; the `version` the form read travels with every save, as in the program application.

## Errors

New codes of `ProposalErrorCode`, all starting `PROPOSAL_`: `USE_CASE_NOT_OPEN` (not found, not published or past its close), `OWN_USE_CASE`, `ORGANIZATION_NOT_APPROVED`, `ORGANIZATION_REQUIRED` (reused), `ALREADY_SENT`, `PROFILE_INCOMPLETE`, `TEAM_INVALID`, `TEAM_INCOMPLETE`, `PDF_REQUIRED`, `SOLUTION_REQUIRED` (reused), `APPROACH_REQUIRED`, `CHANGED_MEANWHILE` (reused), `SOLUTION_NOT_FOUND` (a solution that is not the organization's, or named twice), `EDIT_WINDOW_CLOSED` (a save of a sent proposal after its edit window, or with no edit days, or after the use case closed; `ALREADY_SENT` stays for sending a sent proposal), `PROPOSAL_NOT_FOUND` (read of a proposal that does not exist or is not the caller's to read). `USE_CASE_NOT_OPEN` is `USE_CASE_NOT_FOUND` and `USE_CASE_CLOSED`, and `ORGANIZATION_REQUIRED` is `NO_ORGANIZATION`, in the code.

## Web

Pages (App Router, thin) and the feature folder `web/src/features/proposal`:

- `/use-cases/[id]/propose`: the wizard. Server state is the working copy; the profile step reuses `TalentForm`'s fields and rules; **Save and return later** saves and goes back to the use case.
- The use case page: **Send a proposal** links to the wizard (no Save for later); the "Proposals" tile shows the count.
- The sender's view page and the poster's detail page share the Sender profile card, the solution cards and the team table (name over a muted email).
- `/workspace/organization/use-cases/[id]/proposals` and `.../[proposalId]`: the list with the tabs All, Shortlisted and Declined (the last two empty and inert for now), and one proposal read-only; the Shortlist and Decline buttons are drawn and disabled.
- My organization › Use cases: a Proposals column and **View proposals** in the row menu.

Texts in both catalogs; no raw colours; shadcn components from `components/ui`.

## Research

Mobbin, October 2026: proposal lists and review of applicants ([Upwork](https://mobbin.com/screens/fe4de0f6-5051-48fd-a149-1432a6a06258), [Behance](https://mobbin.com/screens/5f155f6c-c9c5-42e8-be18-985f7ae4a147), [Homerun](https://mobbin.com/screens/c4ce5f75-da60-4a2d-b15d-df5cc1ef5739)); one applicant ([Wellfound](https://mobbin.com/screens/0f7d959d-1ec6-4ea4-8902-5b366a3603bc), [Homerun](https://mobbin.com/screens/ead6259e-7752-4590-adcd-dc1e00d49ba1)); member tables and inline editing ([Clerk](https://mobbin.com/screens/731c7344-9391-48db-b387-db09d09f5d1e), [Podia](https://mobbin.com/screens/420dbc8f-7e2d-41b1-85c0-db7842bcd5a6), [Navan](https://mobbin.com/screens/23ac1585-3cc4-4d20-83ef-1a30e453c6f1), [Attio](https://mobbin.com/screens/191ac4d4-fbd9-4339-8d2f-737bb3b48eb0)).

## Not verified

Nothing has run yet. Open until the plan's last step: the behaviour of the merge listener on a conflicting proposal; the load of `proposal-counts` with the public use case list.
