# One review lifecycle for organizations, solutions, use cases and talent

Status: in progress, 6 October 2026. Tracked in [BEY-76](https://linear.app/beyondpilot/issue/BEY-76). The research behind it: [the review lifecycle](../../../research/2026-10-06-review-lifecycle.md).

GenAI Fund reviews four kinds of record before the public sees them. Each module named and shaped that review its own way: four names for "waiting for review", three ways to send something back, two ways to take it down. One provider now meets all four, and the import of the old platform's 2,400 startups (BEY-74) and 233 use cases (BEY-75) writes into them, so the review is made one before that data arrives.

## Three separate things

The products and codebases that review what their users publish keep three things apart, and so does BeyondPilot ([brief §7.5](../../../brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#75-ai-solutions): approval, directory visibility and matching eligibility are not one state).

| Axis | Who changes it | Column | Kinds |
| --- | --- | --- | --- |
| **Review**: what GenAI Fund decided | The owner sends; an operator decides | `status` | All four |
| **Listing**: whether the owner shows it in the directory | The owner | `listed` | Solution, talent |
| **Takedown**: GenAI Fund removed it after approving it | An operator; reversible | `suspended_at`, `suspension_reason`, `suspension_message` | Organization, solution, talent |

Whether a record is public is read from the three, never stored: a solution or a profile is public when it is `approved`, `listed` and not taken down; a use case when it is `approved`, not past `closes_at` and not taken down. A solution is eligible for matching when it is `approved` and not taken down, whether listed or not.

## The review

```
draft ──send──► in_review ──approve──► approved
  ▲                │   │
  │                │   └──reject──► rejected
  └──change, send──┴── needs_changes
       again
```

| Status | Meaning |
| --- | --- |
| `draft` | Its owner is writing it. Nobody else sees it |
| `in_review` | Sent; waits for an operator |
| `needs_changes` | Sent back with a reason the owner reads. The owner changes it and sends it again |
| `approved` | Accepted |
| `rejected` | Refused for good, with a reason: a duplicate, not a real organization, not an AI solution. The owner cannot send it again; an operator can reopen it by approving it |

A kind uses only the statuses it needs:

| Kind | Statuses |
| --- | --- |
| Organization | `in_review`, `needs_changes`, `approved`, `rejected`. It is sent when it is created, so it has no draft |
| Solution | All five |
| Use case | `draft`, `in_review`, `needs_changes`, `approved`. No operator action refuses a use case for good yet |
| Talent | `draft`, `in_review`, `needs_changes`, `approved` |

A refusal for missing information is a send back, not a rejection: the old `rejected` rows whose reason is `incomplete` become `needs_changes`, and `incomplete` leaves the rejection reasons of organizations and solutions.

## Taking down

An operator takes an approved record down with a reason its owner reads; it leaves the directories, the search index and matching at once, and its review status stays `approved`. Restoring it puts it back as it was, without a new review.

- **Organization:** as today (V30), except that `suspended` stops being a status. The status of a taken-down organization is `approved` and `suspended_at` says it is down.
- **Solution:** taking down was a rejection of an approved solution; it becomes a takedown, with Restore beside it.
- **Talent:** `removed` becomes a takedown. As today, the person can correct the profile and send it again; approving it lifts the takedown.
- **Use case:** none yet. Sending an approved use case back already takes it out of the directory, and its members correct it.

## Values that change

| Kind | Old | New |
| --- | --- | --- |
| Organization | `pending` | `in_review` |
| Organization | `rejected` with reason `incomplete` | `needs_changes` |
| Organization | `suspended` | `approved`, taken down |
| Solution | `submitted` | `in_review` |
| Solution | `rejected` after an approval (a takedown, per the audit log) | `approved`, taken down |
| Solution | any other `rejected` | `needs_changes` |
| Customer deployment | `submitted` | `in_review` |
| Use case | `published` | `approved` |
| Talent | `submitted` | `in_review` |
| Talent | `changes_requested` | `needs_changes` |
| Talent | `removed` | `approved`, taken down |

Before this change a solution's rejection was never final: its owners corrected it and sent it again, and an approved solution taken out of the directory was stored as rejected too. So no stored rejection becomes the new final one: when the last decision before it was an approval it becomes a takedown, and otherwise a send back. A solution sent again drops the reason it was sent back with.

## Commands and API

The paths stay; operators gain the commands that were missing.

| Kind | New command | Path |
| --- | --- | --- |
| Organization | Send back | `POST /api/organization/admin/organizations/{id}/send-back` |
| Solution | Send back | `POST /api/solution/admin/solutions/{id}/send-back` |
| Solution | Take down, restore | `POST /api/solution/admin/solutions/{id}/take-down`, `/restore` |
| Talent | Restore | `POST /api/talent/admin/profiles/{id}/restore` |

`remove` of a talent profile becomes `take-down`, and `reject` of a solution refuses only one that waits for review. Each response carries `status` from the review and, where a kind can be taken down, `suspendedAt`, `suspensionReason` and `suspensionMessage`. An operators' list filters by any review status or by `suspended`.

Every decision is audited through `audit`, which is the history; a send back and a takedown each email the owner, as the decisions do today.

## Decisions

1. **The column stays `status`.** Renaming it to `review_status` would touch every query for no reader's benefit; the values carry the meaning.
2. **One badge.** `components/composites/review-status.tsx` renders every kind's status and the taken-down state; the talent page's own tone map is removed.
3. **Editing an approved record is not changed here.** Today a use case saved after approval goes back to draft, and the other kinds stay public as they are edited. The research favours keeping the record public while a change waits ([what recurs](../../../research/2026-10-06-review-lifecycle.md#what-recurs), point 5); that is a separate change for each owner of a module.
4. **The rule is written once.** [Conventions](../../../conventions.md#review-lifecycle) state it, so the next kind that GenAI Fund reviews follows it.
