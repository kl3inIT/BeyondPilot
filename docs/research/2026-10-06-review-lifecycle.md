# How other products review what their users publish

Written on 6 October 2026 for BEY-76. The question: one review lifecycle for organizations, solutions, use cases and talent profiles. GenAI Fund reviews each before the public sees it. Each module had named and shaped the review differently:

| Step                    | Organization | Solution                               | Use case                    | Talent              |
| ----------------------- | ------------ | -------------------------------------- | --------------------------- | ------------------- |
| Being written           | —            | `draft`                                | `draft`                     | `draft`             |
| Waiting for review      | `pending`    | `submitted`                            | `in_review`                 | `submitted`         |
| Sent back to be changed | —            | none: `rejected` with reason `incomplete` | `needs_changes`          | `changes_requested` |
| Accepted                | `approved`   | `approved`                             | `published`                 | `approved`          |
| Refused for good        | `rejected`   | `rejected`                             | —                           | —                   |
| Taken down afterwards   | `suspended`  | —                                      | —                           | `removed`           |
| Owner hides it          | —            | `listed`                               | —                           | `listed`            |

Seven codebases were read from source and fifteen products from their official documentation; nothing was run. Paths are relative to each repository.

## Codebases

| Codebase                                                     | Version read | Why it was read                                                                       |
| ------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------- |
| [wagtail/wagtail](https://github.com/wagtail/wagtail), `.tmp/wagtail`             | `d56403c`    | A moderation workflow kept apart from whether a page is live, with a live copy beside a pending revision |
| [discourse/discourse](https://github.com/discourse/discourse), `.tmp/discourse`    | `f18a198`    | A review queue with a history table, and hiding as a flag                               |
| [pretalx/pretalx](https://github.com/pretalx/pretalx), `.tmp/pretalx`              | `5b1b5d3`    | Submissions accepted or rejected by organisers and withdrawn by speakers                |
| [decidim/decidim](https://github.com/decidim/decidim), `.tmp/decidim`              | `597d102`    | Proposals answered by an organisation, and moderation by hiding                        |
| [saleor/saleor](https://github.com/saleor/saleor), `.tmp/saleor`                   | `1cdffca`    | Publication, listing and availability as three separate fields                         |
| [medusajs/medusa](https://github.com/medusajs/medusa), `.tmp/medusa`               | `a9c14c09`   | One product status that means both approved and public                                 |
| [payloadcms/payload](https://github.com/payloadcms/payload), `.tmp/payload`        | `31ba7ee`    | Drafts and published versions without a review step                                    |

| Codebase | Review states | Approved and public | Sent back vs refused | Taken down afterwards | Editing an approved item |
| --- | --- | --- | --- | --- | --- |
| Wagtail | Workflow `in_progress`, `approved`, `needs_changes`, `cancelled` (`wagtail/models/workflows.py:103-112`) | Two concepts: the page has `live` and `has_unpublished_changes` (`wagtail/models/draft_state.py:14-41`) | "Request changes" sets the workflow to `needs_changes`, and `resume()` sends it back to review (`workflows.py:202, 262-277`) | `unpublish()` sets `live` to false | The live revision stays public while a newer one is reviewed; non-reviewers are locked out (`workflows.py:870-882`) |
| Discourse | `pending`, `approved`, `rejected`, `ignored`, `deleted` (`app/models/reviewable.rb:38`) | Approval creates the public post | "Revise and reject" carries `revise_reason` and `revise_feedback` (`app/models/reviewable_queued_post.rb:158-198`) | A flag: `hidden`, `hidden_reason_id`, `hidden_at`, undone by `unhide!` (`app/models/post.rb:653-721`) | Live at once; with `review_every_post` the edit is reviewed afterwards (`lib/post_revisor.rb:437`) |
| pretalx | `draft`, `submitted`, `accepted`, `confirmed`, `rejected`, `withdrawn`, `canceled` (`src/pretalx/submission/enums.py:11-32`) | Two: an accepted talk is public only when the schedule is released | No send-back state; an organiser can reverse a rejection | `canceled` by the organiser | Speakers edit accepted talks and the change is live (`models/submission.py:338-376`) |
| Decidim | Answer `evaluating`, `accepted`, `rejected`, plus timestamps (`decidim-proposals/app/models/decidim/proposals/proposal.rb:285-320`) | Three: the author publishes, the organisation answers, the answer is published | No | `hidden_at` with a report count, undone by `UnhideResource` (`decidim-core/lib/decidim/reportable.rb:14-50`) | Allowed only before the answer is published |
| Saleor | No review | `is_published`, `visible_in_listings`, `available_for_purchase_at` (`saleor/product/models.py:311-351`) | — | `is_published` false | Live at once |
| Medusa | `draft`, `proposed`, `published`, `rejected` (`packages/core/utils/src/product/enums.ts`) | One field | No; any status can be set from a dropdown | Back to `draft` | Live at once |
| Payload | `_status` `draft` or `published` (`packages/payload/src/versions/baseFields.ts:7-25`) | One field | — | `unpublish` back to `draft` | The published copy stays while drafts accumulate (`docs/versions/drafts.mdx:133-148`) |

Every codebase that reviews keeps the reason with the decision and the history in an append-only log: Wagtail `TaskState.comment` and `PageLogEntry`, Discourse `reviewable_histories`, pretalx `ActivityLog`, Decidim `ActionLog`.

## Products

| Product | States | Fix and resubmit vs final no | Taken down by the platform | Hidden by the owner | Editing a live listing |
| --- | --- | --- | --- | --- | --- |
| [Apple App Store Connect](https://developer.apple.com/help/app-store-connect/reference/app-and-submission-statuses) | Prepare for Submission, Waiting for Review, In Review, Pending Developer Release, Ready for Distribution, Rejected, Metadata Rejected | Metadata Rejected (fix the page) differs from Rejected (the build failed); both can be resubmitted | Removed from the App Store, restorable | Developer Removed from Sale | [A new version is reviewed while the old one stays live](https://developer.apple.com/help/app-store-connect/update-your-app/create-a-new-version/) |
| [Google Play](https://support.google.com/googleplay/android-developer/answer/9859751) | Draft, In review, Update rejected, App rejected, Ready to publish, Unpublished | Rejected, then fix and resubmit or appeal | Removed by Google (resubmit) and Suspended by Google (appeal only) | Unpublished | Changes in review do not affect the live version |
| [Chrome Web Store](https://developer.chrome.com/docs/webstore/review-process) | Draft, Pending review, Published, Rejected, Taken down, Staged | A warning with a cure period for live items | Taken down, appealable | Unpublish | The published version stays live during review |
| [Shopify App Store](https://shopify.dev/docs/apps/launch/app-store-review/review-process) | Draft, Submitted, Paused, Reviewed, Published | Paused: requirements are missing and reviewers send the required changes | Periodic audits | — | — |
| [HubSpot Marketplace](https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/listing-your-app/) | Draft, Submitted for review, Published | Feedback sends the listing back to Draft with comments | — | — | Edit the live listing, then submit for review again |
| [Atlassian Marketplace](https://developer.atlassian.com/platform/marketplace/listing-and-managing-apps/) | Private, Submitted, Public, Archived, Hidden | — | Hidden by Atlassian | Archive | New listings are approved; new versions are not |
| [Fiverr](https://help.fiverr.com/hc/en-us/articles/360011028318-Managing-your-Gigs) | Draft, Pending Approval, Requires Modification, Active, Denied, Paused | Requires Modification differs from Denied, which is final | Paused by Fiverr | Paused | Large edits return the gig to Pending Approval |
| [Airbnb](https://www.airbnb.com/help/article/476) | Listed, Snoozed, Unlisted, Deactivated | n/a | Suspension is separate from visibility | Snooze or unlist | — |
| [Etsy](https://help.etsy.com/hc/en-us/articles/360040986253-Why-Is-My-Listing-Inactive) | Draft, Active, Inactive, Expired | No review before listing | Removed for a policy issue | Deactivate | — |
| [Google Business Profile](https://support.google.com/business/answer/4569145) | Pending verification, Verified, Suspended | — | Suspended, reinstated on appeal | — | The owner can edit while suspended |
| [Stripe Connect](https://docs.stripe.com/connect/handling-api-verification) | Enabled, In review, Restricted soon, Restricted | Requirements due; no final refusal | Restricted | — | Verification runs again when new requirements arise |
| [Devpost](https://help.devpost.com/article/102-managing-submissions) | Submissions checked for eligibility | "Requires revisions" before the deadline | Hidden by the manager | — | — |
| [Product Hunt](https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines) | Posted, Featured | Featuring decisions are final | Removed from featured | — | — |

Two help pages refused automated reading (Fiverr and the Salesforce AppExchange security review); Fiverr's state names come from a quotation of its page, and Salesforce was left out.

On Mobbin: [Whop](https://mobbin.com/screens/df1d154d-df4a-48af-913b-2b2fc3ff6326) tabs submissions by Pending, Approved, Rejected and Flagged with counts; [Airwallex](https://mobbin.com/screens/68f1a7f7-0e87-49a9-a9a9-6ec913167bf0) gives the reviewer "Require resubmission" with a reason beside Approve and Reject; [Deel](https://mobbin.com/screens/5468f0b0-3c76-4d96-98b9-52f3d85d214e) requires a rejection reason that the other party reads; [Cofounder](https://mobbin.com/screens/3f704e54-eb37-425e-b3a2-096ba3e894c0) shows "Preview has unpublished changes ready for review" beside the live version.

## What recurs

1. **Review, visibility and takedown are three fields.** Wagtail, pretalx, Decidim, Saleor, Apple, Google Play and Airbnb separate whether the platform accepted an item, whether its owner shows it, and whether the platform took it down. Only Medusa and Payload, which have no real review, use one status for approved and public.
2. **Sent back is not refused.** Wagtail `needs_changes`, Fiverr Requires Modification, Shopify Paused, Apple Metadata Rejected and Airwallex "Require resubmission" all name a fixable outcome. `needs_changes` is the name in code; "Request changes" is the button.
3. **A refusal is final for the owner, not for staff.** Fiverr's Denied cannot be resubmitted; Discourse and pretalx let staff reopen a rejection.
4. **Taking down is a reversible flag with a reason**, never a review state and never a deletion: Discourse `hidden_at`, Decidim `hidden_at`, Google Play Suspended, Google Business Profile Suspended.
5. **Editing an approved item never sends the whole item back to the queue.** Either the change is live and reviewed afterwards (Discourse, pretalx, HubSpot's listing edits), or the live copy stays while a revision waits (Wagtail, Apple, Google Play, Chrome).
6. **The most common names:** `draft`; `in_review` or pending review for waiting; `needs_changes` or changes requested for sent back; `approved` for the decision; `rejected` for the final no; published, live or listed for visibility; suspended, hidden or taken down for the platform's takedown.

The lifecycle BeyondPilot takes from this is in [BEY-76's design](../increments/active/bey-76-review-lifecycle/design.md).
