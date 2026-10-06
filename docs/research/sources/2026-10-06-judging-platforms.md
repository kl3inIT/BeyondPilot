# How real platforms run judging and application review

Research date: 2026-10-06. Public sources only (help centers, docs, official program pages). No account was created and nothing was submitted. Every claim below cites the page it comes from; "not documented" means the public pages fetched did not say, not that the feature is absent.

Products that behave differently are kept apart: Devpost.com (public hackathons) vs Devpost for Teams (internal hackathons), and Submittable classic (our label for the `submittable.help` product) vs Submittable Next (`next.support.submittable.com`, the award-cycle product).

---

## 1. Devpost.com (public hackathons)

Sources:

- [Step 8: Setting up judging](https://help.devpost.com/article/131-setting-up-judging) (S1)
- [How to judge an online hackathon](https://help.devpost.com/article/103-how-to-judge-an-online-hackathon) (S2)
- [Judging & public voting](https://help.devpost.com/article/64-judging-public-voting) (S3)
- [Creating categories for judging](https://help.devpost.com/article/159-creating-categories-for-judging) (S4)
- [Starting the judging period](https://help.devpost.com/article/105-starting-the-judging-period) (S5)
- [Monitoring the judges' progress](https://help.devpost.com/article/106-monitoring-the-judges-progress) (S6)
- [Ending the judging period and selecting winners](https://help.devpost.com/article/107-ending-the-judging-period-and-selecting-winners) (S7)
- [Announcing winners](https://help.devpost.com/article/104-announcing-winners) (S8)
- [How to edit a submission](https://help.devpost.com/article/123-how-to-edit-a-submission) (S9)
- [Enabling late submissions](https://help.devpost.com/article/90-enabling-late-submissions) (S10)
- [Moderate submissions: admin module](https://help.devpost.com/article/95-moderate-submissions-admin-module) (S11)

1. **Who judges, sign-in, what they see.** "You can add anyone with an email address as a judge"; when judging starts each judge gets an email that asks them "to create an account, if they don't have one already" (S1). "Each judge will receive a unique link that will work only for that judge" (S5), and "The only way to get to your judging dashboard is to click Start Judging in the email", which judges are told not to forward (S2). The organizer marks each submission "Judge" or "Don't Judge" before judging starts (S5). With categories, "Judges will only be able to view the projects associated with the categories that you assigned to them", and they must be assigned "BEFORE the Judging period begins" (S4).
2. **Scoring.** Judges rate each criterion "on a 1-5 scale" (S1); "1 star is the lowest rating and 5 is the highest" (S2). Weights: "The Devpost online judging platform does not currently support varying weights"; unequal weights need offline judging (S3). Comments: the setup article offers "Enable judge comments" as required or optional, exportable (S1), while the judge article says "There is no other mechanism for judges to provide feedback" beyond star ratings (S2). The two articles disagree. Editing: judges can "edit any of your prior scores" from the judging dashboard (S2).
3. **Visibility.** Organizers see "which judges have started judging and their scores" (S6). Whether a judge can see other judges' scores is not documented.
4. **Assignment and conflicts.** Assignment is by category (S4); Devpost recommends sending judges "a max of 30 projects" and giving them 1-2 weeks (S3). Conflict: the judge can select "I recuse myself" on a submission (S2). Progress is tracked on the organizer's Judging/Voting tab (S6).
5. **Decision.** The organizer decides: after ending judging, they see "a list of all the judged submissions and drag them into the winners list", matching each to a prize (S7). The organizer's view of scores is not described in that article. No "shortlist / not selected" state for entrants is documented.
6. **Release.** Winners can be announced immediately or scheduled; "An automatic email will be sent to the winners", an update goes to all participants, and the "Project Gallery will be updated to show winner banners" (S8). Whether an announcement can be recalled, and whether scores or comments reach entrants, is not documented for Devpost.com (S8). For public voting Devpost recommends "not showing the results live until you review your votes" (S3).
7. **Versions.** "You can access and make changes to your submission until the submission deadline. Once the deadline passes, you can still make changes to your project but these changes will not be reflected in your hackathon submission" (S9). The organizer can enable late submissions; for online hackathons this creates a private link, and Devpost advises turning it off "to avoid any rogue submissions moving onto judging" (S10). Submissions start "Pending" and are moderated to "Gallery" or "Hidden" (S11).

## 2. Devpost for Teams (internal hackathons)

Sources:

- [How to set up judging and voting](https://help.devpost.team/article/230-how-to-set-up-judging) (T1)
- [How judging works](https://help.devpost.team/article/231-how-judging-works) (T2)
- [How to judge projects on Devpost for Teams](https://help.devpost.team/article/289-how-to-judge-projects-on-devpost-for-teams) (T3)
- [How to announce winners and share feedback](https://help.devpost.team/article/233-how-to-announce-winners-and-share-feedback) (T4)

1. **Who judges.** A judge is a coworker who is a "Member" of the organization's Hackathon Center; a guest "must first be invited to and register for the hackathon as a Guest participant" (T1). Judges are notified by email when a round starts (T2) and see "only the projects that the organizer has specifically assigned to you" (T3).
2. **Scoring.** Two methods: scored (1-5 per criterion, aggregated) or ranked ("higher ranks count more") (T1, T2). Weights are optional percentages that "must add up to exactly 100%" and "lock when a judging round starts" (T1). The comment box is optional (T3). Judges "can revisit and edit your scores at any time before the organizer ends the judging period" (T3).
3. **Visibility.** Organizers get "Scores & comments by judge" reports and can "view each project's results" during judging (T2). Whether judges see each other's scores is not documented.
4. **Assignment.** Projects are assigned to judging groups (T2). Organizers "can see which judges completed their score sheets" (T2). Rounds can "carry forward top-scoring projects for another round" (T2).
5. **Decision.** The organizer picks a winner per award from a dropdown where "Projects are listed starting with the highest average scores" (T4). So the computed ranking orders the list, and a person decides.
6. **Release.** The organizer can "Save your choices" as a draft or "Announce winners: Publish the results immediately"; a Winners Gallery then appears on the hackathon page (T4). Feedback is a separate step: the organizer chooses to share the "Round score" (average) and/or "Individual judge feedback", can anonymize judge names, and the feedback "appears on the submitters' project pages" with an email notification (T4). Recall is not documented.
7. **Versions.** Not documented for Teams.

## 3. Submittable classic (submittable.help)

Sources:

- [Permission levels](https://submittable.help/en/articles/6641379-permission-levels) (C1)
- [Getting started for reviewers](https://submittable.help/en/articles/3935413-getting-started-for-reviewers-video-and-faq) (C2)
- [Submittable's guide for reviewers](https://www.submittable.com/blog/submittables-guide-for-reviewers) (C3)
- [How can I set up multi-stage reviews?](https://submittable.help/en/articles/5139345-how-can-i-set-up-multi-stage-reviews) (C4)
- [Can reviewers edit finalized review forms?](https://submittable.help/en/articles/4413291-can-reviewers-edit-finalized-review-forms) (C5)
- [Shareable reviews](https://submittable.help/en/articles/3603715-shareable-reviews) (C6)
- [Conceal responses](http://submittable.help/en/articles/5345017-conceal-responses) (C7)
- [How can I allow a submitter to edit a submission?](https://submittable.help/en/articles/5021655-how-can-i-allow-a-submitter-to-edit-a-submission) (C8)
- [What notifications should I expect as a submitter?](https://submittable.help/en/articles/4926006-what-notifications-should-i-expect-to-receive-from-submittable-as-a-submitter) (C9)
- [How can I accept or decline submissions in bulk?](https://submittable.help/en/articles/935222-how-can-i-accept-or-decline-submissions-in-bulk) (C10)
- [Building a fair and efficient grant review process](https://www.submittable.com/guides/building-fair-efficient-grant-review-process) (C11)
- [Best practices: review processes](https://www.submittable.com/blog/best-practices-review-processes) (C12)

1. **Who reviews.** Reviewers are team members of the organization's account. An invited reviewer gets an email "providing a link for you to accept the invitation and set your password" (C3), so they hold a Submittable account and switch to the organization under "Team Accounts" (C2). Levels 1-2 "View only assigned submissions"; Level 5 can "view all submissions" and "view all reviews" (C1).
2. **Scoring.** Either Yes/No/Maybe votes ("A yes vote equals one point, A no vote is a negative point, and A maybe vote is zero points") or a custom review form with open questions and rating questions tied to a numerical score (C3). Reviews can be saved and submitted later (C2). Editing a finalized review is off unless a Level 4-5 admin ticks "Enable Editing" for the project, and can be relocked (C5).
3. **Visibility.** "Level 1, 2, and 3 reviewers will only see their own vote (or custom review)"; Levels 4-5 see who is assigned, votes cast, and the average (C4). Submittable recommends "assign low permission levels to reviewers" so reviewers do not influence each other (C12), and describes keeping "reviewer scores confidential, viewable to administrators only" and hiding "the previous score or ranking" between rounds (C11). Blind review: "The submitter's name, email address, file names, and SSN/ITIN information will be hidden from reviewers" with Conceal Response (C7).
4. **Assignment.** Manual assignment or "Auto-Assign Reviewers" per stage; admins see "how many votes have been cast out of the expected total, and the average overall score", and a checkmark when all reviews for a stage are done (C4).
5. **Decision.** Reviews and decisions are separate: Levels 1-2 cannot change a submission's status; Level 3+ can (C1). The admin selects submissions and clicks "Accept" or "Decline" (C10).
6. **Release.** On accept or decline "A dialog box will appear where you can select a response template to populate the email message" to the submitter (C10); submitters are notified on "Accepted, Declined, Completed" (C9). Reviews can be shared with submitters only from fields marked "Make Shareable", shown as "Reviewer 1 and Reviewer 2" rather than names, individually or in bulk, with an email notification (C6).
7. **Versions.** A Level 3-5 member can "Open Editing" for a submitter, who then edits and resubmits; the submission shows a pencil icon while open (C8). "Level 1 and 2 reviewers cannot see assigned submissions if they are open for editing" (C1).

## 4. Submittable Next (award cycles)

Sources (Zendesk API copies of the public help center pages):

- [Set up a review round](https://next.support.submittable.com/hc/en-us/articles/30264107224983-Set-Up-a-Review-Round) (N1)
- [Feedback types and setup in a review round](https://next.support.submittable.com/hc/en-us/articles/30264130039575-Feedback-Types-and-Setup-in-a-Review-Round) (N2)
- [Assign reviewers to the review round](https://next.support.submittable.com/hc/en-us/articles/30264144668823-Assign-Reviewers-to-the-Review-Round) (N3)
- [Assign reviewers manually](https://next.support.submittable.com/hc/en-us/articles/30263933151767-Assign-Reviewers-Manually) (N4)
- [How to complete a review](https://next.support.submittable.com/hc/en-us/articles/30263776290199-How-to-Complete-a-Review) (N5)
- [Using the conflict of interest question in review rounds](https://next.support.submittable.com/hc/en-us/articles/43024572060055-Using-the-Conflict-of-Interest-Question-in-Review-Rounds) (N6)
- [Set up program member types](https://next.support.submittable.com/hc/en-us/articles/30263842573079-Set-Up-Program-Member-Types) (N7)
- [Select award recipients (deadline-based cycles)](https://next.support.submittable.com/hc/en-us/articles/30264027757463-Select-Award-Recipients-Deadline-Based-Cycles) (N8)
- [Disqualify an applicant](https://next.support.submittable.com/hc/en-us/articles/42037234680343-Disqualify-an-Applicant) (N9)
- [View & track your application status](https://next.support.submittable.com/hc/en-us/articles/41067081469463-View-Track-Your-Application-Status) (N10)
- [Award communications: email trigger guide](https://next.support.submittable.com/hc/en-us/articles/39640729960215-Award-Communications-Email-Trigger-Guide) (N11)
- [Reverse an award offer](https://next.support.submittable.com/hc/en-us/articles/40115251575063-Reverse-an-Award-Offer) (N12)
- [Closing an award cycle](https://next.support.submittable.com/hc/en-us/articles/35505630888471-Closing-an-Award-Cycle) (N13)
- [Edit submitted applications](https://next.support.submittable.com/hc/en-us/articles/37188000161559-Edit-Submitted-Applications) (N14)
- [Building custom review feedback forms](https://next.support.submittable.com/hc/en-us/articles/30264180302487-Building-Custom-Review-Feedback-Forms) (N15)

1. **Who reviews.** Roles per program: Program Owner (only one; "can finalize awards"), Program Manager (everything except changing the owner and finalizing award decisions), Program Staff (view-only), Reviewers ("only has access to review their assigned applications") (N7). Reviewers must be invited to the program first (N1, N4). They get an email per new assignment and log in from its link (N5). Admins can hide intake form fields from reviewers; hidden fields stay visible to administrators (N1).
2. **Scoring.** Three feedback types per round: Scoring, Voting (two choices, labels editable), Custom feedback form (N2). Scoring: each criterion has its own min/max (example 1 to 20) and a weight; "Weights across all Score Fields must add up to 100%" (N2). A notes text box is optional per round (N2). "Should reviewers be able to edit their feedback after submission?" is a per-round Yes/No; "Not allowing edits keeps an untouched record of each reviewer's original feedback" (N2). Reviewers can "Save as Draft" and submit later (N5). "Once a review round begins, the review round settings cannot be changed" (N2). The custom feedback form "is only used by reviewers and not seen by applicants" (N15).
3. **Visibility.** The reviewer's page shows their own assignments and their own submitted feedback (N5); no view of other reviewers' feedback is described. For later rounds the admin can choose "forms from previous rounds that you want reviewers in this round to see" (N1). Admins view feedback "side-by-side with the applicant's Intake form" (N15).
4. **Assignment and conflicts.** Options: all applications to every reviewer; a set number of reviewers per application, distributed randomly "as evenly as possible"; or review groups (random, by an intake field, or custom) (N1, N3). Manual assignment is for new reviewers or to replace one who declared a conflict (N4). Conflict of interest is an optional question shown before the form; a reviewer who declares one gives a comment (optionally required), the assignment becomes "Declined" and read-only, the response "is final and cannot be changed", and the Program Owner gets a "Review Assignment Declined" email (N5, N6). Progress: each reviewer sees total assignments, feedback due, and percent submitted; statuses Not Started, Opened, Started, Submitted, Declined (N5).
5. **Decision.** Only the Program Owner can "Start Final Decision"; after that "reviewer feedback can no longer be edited". The owner ticks candidates, "Add Selected", can review or "Cancel Selection", then "Finish Decision"; the screen records who made the selections and when. In deadline-based cycles "any candidate you don't select is automatically waitlisted" (N8). Disqualification requires a reason (or "Other" with text), emails the applicant, and the reason is visible to admins; the applicant portal "doesn't display a reason for disqualification" (N9, N10).
6. **Release.** "Applicants are not notified when they're Selected or Waitlisted"; both see "Under Review" until the admin designates award offers or closes awarding (N8). Applicant statuses: Draft, Submitted, Under Review, Revisions Requested, Disqualified, Selected, Awarded, Declined; an email goes out on the marked ones if notifications are enabled (N10). Award emails are per trigger (Notify, Reversed, Waitlisted, Selected, etc.), several on by default, all "Immediate" by default (N11). Recall: an award can be reversed "only ... while it's in 'Offered' status ... Once an award is 'Accepted,' it can no longer be reversed"; the applicant gets an email and sees "Under Review" again (N12). Closing a deadline-based cycle sends waitlisted applicants "Not Selected" and the denied email, and "Cycle Closure Is Permanent" (N13). Sharing reviewer feedback with applicants is not documented in Next.
7. **Versions.** Admins can request revisions (applicant edits and resubmits) or edit a submitted application themselves, with a required reason; the applicant gets an "Application Edited" email, and applicants and reviewers see an "Edited" tag on each changed field; edit logs record who changed what. "If the applicant is also editing the application at the same time, the applicant's version is kept." Editing works only in the active round (N14).

## 5. Award Force

Sources (Zendesk API copies of public help pages, plus one blog post):

- [Understanding judging modes](https://support.awardforce.com/hc/en-us/articles/207420243-Understanding-judging-modes) (A1)
- [VIP judging configuration](https://support.awardforce.com/hc/en-us/articles/208175846-VIP-judging-configuration) (A2)
- [Scoring criteria](https://support.awardforce.com/hc/en-us/articles/360000381495-Scoring-criteria) (A3)
- [Configure score sets](https://support.awardforce.com/hc/en-us/articles/115000533063-Configure-score-sets) (A4)
- [Share scores and comments between judges](https://support.awardforce.com/hc/en-us/articles/207995093-Share-scores-and-comments-between-judges) (A5)
- [Feedback: sharing judge scores and comments with entrants](https://support.awardforce.com/hc/en-us/articles/360001354036-Feedback-sharing-judge-scores-and-comments-with-entrants) (A6)
- [Lock and unlocking judge scores](https://support.awardforce.com/hc/en-us/articles/360001192436-Lock-and-unlocking-judge-scores) (A7)
- [Abstain versus recuse](https://support.awardforce.com/hc/en-us/articles/360000212676-Abstain-versus-recuse-what-s-the-difference) (A8)
- [Adding judges](https://support.awardforce.com/hc/en-us/articles/210145006-Adding-judges) (A9)
- [Entry resubmission](https://support.awardforce.com/hc/en-us/articles/360000650095-Entry-resubmission) (A10)
- [Why don't you display the total of judging scores?](https://support.awardforce.com/hc/en-us/articles/208034136-Why-don-t-you-display-the-total-of-judging-scores-on-an-entry) (A11)
- [Ultimate guide for judges](https://support.awardforce.com/hc/en-us/articles/4405859035151-Ultimate-guide-for-judges) (A12)
- [Moving entries between judging stages and selecting winners](https://support.awardforce.com/hc/en-us/articles/217977403-Moving-entries-between-judging-stages-and-selecting-winners) (A13)
- [Can entrants edit submitted entries?](https://support.awardforce.com/hc/en-us/articles/360000222836-Can-entrants-edit-submitted-entries) (A14)
- [Judging progress view](https://support.awardforce.com/hc/en-us/articles/4402493169551-Judging-progress-view) (A15)
- [Assignments and their common uses](https://support.awardforce.com/hc/en-us/articles/360000543936-Assignments-and-their-common-uses) (A16)
- [How do I give my judges access to the leaderboard?](https://support.awardforce.com/hc/en-us/articles/360001112456-How-do-I-give-my-judges-access-to-the-leaderboard) (A17)
- [Do I need broadcasts and notifications?](https://support.awardforce.com/hc/en-us/articles/360000200135-Do-I-need-broadcasts-and-notifications-Are-they-important) (A18)
- [What does a judge see?](https://awardforce.com/blog/articles/what-does-a-judge-see-a-step-by-step-walkthrough-of-the-award-force-judging-experience/) (A19)

1. **Who judges, sign-in, what they see.** Four ways to add judges: manually (name, email, password), bulk import, email invite ("When they accept the invitation, they'll be prompted to provide their name, password..."), or self-registration through a role registration form (A9). Judges registering at the program URL get "a six-digit verification code" that "expires after 10 minutes", then set name and password (A12). Judges work in a judge workspace showing only their assigned entries, optionally after a confidentiality agreement (A19, A4).
2. **Scoring.** Five modes: Qualifying (pass/fail), Top pick (ranking, counted by single transferable vote), VIP judging (criteria scores), Voting (tally), Gallery (view only) (A1). VIP criteria have a maximum score each, an optional weight that "acts as a multiplier", and commenting "invited or required" per criterion; criteria in a score set add to a total (A3). Results are "an average score across all judges" (A1); Award Force deliberately shows averages, not totals, so entries scored by fewer judges (abstain, recusal, unfinished) are not penalized (A11). Editing: a judge changes a score by reopening the entry, but "scores may be locked" (A12); the "Lock scores 5 minutes after submission" option stops edits after five minutes and only a manager can unlock, one entry at a time (A7). The system auto-saves "every few seconds" (A12).
3. **Visibility.** Hidden by default. A manager can share "own scores" or "scores from all judges" between score sets, and the judge role needs "Scores (others) View" set to Allow; judges then see a score matrix with each judge's scores and comments. "Scores and comments can only be shown when a judging round is active", and Award Force recommends locking scores after five minutes or a separate viewing-only round "to help prevent bias" (A5). Leaderboard access for judges is a role permission and is "not restricted by panels or assignments" (A17). Comments can be "internal, shared between judges or shared with entrants" (A4).
4. **Assignment and conflicts.** Assignments come from panels (by category, chapter or tag), manual pairings, or random allocation ("a set number of entries per judge" or "judges per entry") (A16). Conflicts: the judge may Abstain (if enabled; excluded from averages), or a manager Recuses a judge, who "are not notified" and "cannot see affected entries"; a score from a judge recused after scoring becomes a "stray score" excluded from averages (A8). Progress view per judge: total assignments, completed, progress %, abstentions (A15).
5. **Decision.** The manager reads the leaderboard and records outcomes with tags such as "Finalist" or "Winner"; tags drive the next stage's panel, galleries, notifications and certificates (A13). "Award Force gives you full flexibility in determining shortlists, finalists, and winners" (A13).
6. **Release.** Outcomes reach entrants through broadcasts (bulk emails, e.g. "Shortlisting or award outcomes") and notifications (e.g. "Updates to the status of an entry") (A18). Feedback is a separate "feedback round" with start and end dates; options include "Visible to entrants", "Anonymise judges", "Display total scores only", and content of comments, scores, and category average. "Scores shown to entrants represent the average score across all judges"; "Individual judge scores are never shown to entrants"; "Comments marked as internal are never included in feedback"; judges' comments appear only after they complete their assignments (A6).
7. **Versions.** "By default, entrants can edit their entries at any time before the entry round closes", including submitted entries, unless the manager enables "Form locked when submitted" (A14). Resubmission lets a manager reopen selected submitted entries (e.g. extra questions for shortlisted entrants); "Entries requiring resubmission can still be judged unless reverted to 'In progress'" (A10). So judges see the live entry, not a frozen copy.

## 6. Evalato

Sources:

- [Set up a judging round](https://hub.evalato.com/help/set-up-an-evaluation-round) (E1)
- [Evaluation rounds explained](https://hub.evalato.com/help/-evaluation-rounds-explained) (E2)
- [Score voting](https://hub.evalato.com/help/score-voting) (E3)
- [Add judges to evaluate applications](https://hub.evalato.com/help/add-judges-to-evaluate-applications) (E5)
- [FAQ](https://evalato.com/faq) (E6)

1. **Who judges.** Invited judges "receive an email notifying them of the invitation, along with a link to the evaluation portal"; a judge is assigned to "one or more of the application categories" and "one or more of the program's evaluation rounds"; unticking "Active" revokes portal access but keeps their votes (E5). "There is no limit to how many judges you can invite" (E6). The sign-in mechanism behind the link is not documented.
2. **Scoring.** Six voting types: score, popularity, simple review, points, positional, single transferable vote (E2). Score voting uses "custom scorecards, each with its own set of criteria, weights, and scale"; weights are "a ratio or percentage distribution towards the total score where all weight values combined should equal 100"; each criterion has a maximum score (E3). Comments can be "Optional," "Mandatory," or "Disabled" (E1). Optional score normalization "ensures that every entry is scored based on the same set of standards, regardless of how many judges are evaluating" (E1, E3).
3. **Visibility.** A per-round setting can "Allow an evaluator to see how other evaluators have voted on the applications in the assigned category" (E1). Organizers see "live scores, rankings, and judge activity" under Evaluation > Results (E6).
4. **Assignment and conflicts.** By category and round (E5, E6). Abstention: "When a judge declines to vote on an application, the points for the application are calculated as if the judge does not exist" (E3).
5. **Decision.** "The scores given by each judge are then averaged and the candidate with the highest average score is considered the winner" (E3).
6. **Release.** The Results section shows "up-to-date results from every evaluation round of the program and each judge's progress", filterable by round, category and judge. A public "Applications page" can show "a list of all applications approved, details about each application, average rating, individual votes, and comments made by the judges" ([The program menu](https://hub.evalato.com/help/-the-program-menu), E7). Notifying participants of results: not found in the public pages fetched.
7. **Versions.** Not documented in the pages fetched.

## 7. Y Combinator (accelerator)

Sources: [YC FAQ](https://www.ycombinator.com/faq) (Y1), [Apply to YC](https://www.ycombinator.com/apply) (Y2).

1. **Who reviews.** Interviews are with YC general partners, "Most interviews will be held by video conference" (Y2). Who reads written applications is not stated (Y1).
2. **Decision.** "We typically make decisions the same day as your interview" (Y2).
3. **Release and feedback.** Decisions come by a stated date for on-time applicants (Y1, Y2). "We don't provide feedback on application results unless you are invited to interview with us"; interviewees get "detailed feedback about why you were or were not selected" (Y1).
4. **Versions.** "Your application enters our review process once you submit it, so we don't allow continuous editing"; material changes go through a separate update form (Y1).

Scoring, visibility and assignment are not public.

## 8. Gust (accelerator application management)

Sources: [Getting started with Gust for accelerators](https://gust.helpscoutdocs.com/article/345-getting-started-with-gust-for-accelerators) (G1), [What is the average startup rating on gust.com?](https://gust.com/blog/what-is-the-average-startup-rating-on-gust-com/) (G2).

1. **Who reviews.** Evaluators are added by name and email and "Gust will invite them to the platform"; admins vs standard evaluators; "you can restrict which stages in your pipeline they can view", e.g. judges who only see companies past screening (G1).
2. **Scoring.** "Group administrators have the ability to turn ratings on or off, show or hide them, establish the scale for them, and decide on how many criteria a profile is rated"; "Every rating can be accompanied by comments from the reviewer" (G2). Each pipeline stage (default Applied, Screening, Interviews, Selected) has its own evaluation criteria (G1).
3. **Visibility.** Ratings can be shown or hidden by the admin (G2); detail not documented.
4. **Decision.** Admins "can decline companies" from the pipeline (G1).
5. **Release and feedback.** Aggregated reviewer comments make feedback to companies that are not invited back easier (G2); the notification mechanism is not documented.

## 9. F6S-hosted programs (EU open calls)

F6S's own product help was not reachable (the F6S-hosted INNO4CFIs guideline PDF returned 403). The evidence is one program's official guide that names F6S as treasurer and uses an `@f6s.com` contact: [COPILOT Open Call 3 Guide for Applicants](https://copilot-project.eu/wp-content/uploads/2025/08/COPILOT-Open-call-3-PP-Annex-1-Guidelines-For-Applicants-fin.pdf) (F1). It describes the program's rules, not F6S software features.

1. **Who reviews.** An "expert evaluation board ... composed of project partners", each "having signed ... a written commitment of confidentiality and absence of any conflicts of interest" (F1).
2. **Scoring.** "Each application will be reviewed by a minimum of two experts"; experts mark each criterion "between 0 and 5. Half point scores are not given", with a labeled scale (0 Fail ... 4 Very Good); criterion 1 has a minimum threshold of 2.5 out of 5; bonus points for some criteria (F1).
3. **Decision.** Overall score is "calculated from the average scores given by the evaluators"; "Evaluators discuss and agree on the scores"; ranking by overall score; applicants above threshold but not selected "may be placed on a reserve list" (F1).
4. **Release.** "All applicants receive an email with approval or rejection"; "All applicants at all stages of the evaluation will be informed about the result"; non-eligible applications get "a rejection letter with a justification"; rejected applicants get an Evaluation Summary Report (ESR) and may appeal within three working days, on procedure, not merits (F1).
5. **Versions.** Only one application per applicant; "only the application submitted first will be considered" (F1).

## 10. Airtable-based program review

Sources: [Interface Designer permissions](https://support.airtable.com/articles/2193541120-interface-designer-permissions) (R1), [Using Airtable Portals for external collaborators](https://support.airtable.com/articles/5415076460-using-airtable-portals-for-external-collaborators) (R2), [Record review layout](https://support.airtable.com/docs/interface-layout-record-review) (R3), [Using Airtable to manage applications (Impact Ops)](https://www.impact-ops.org/using-airtable-to-manage-applications/) (R4).

1. **Who reviews, what they see.** An interface can filter by current user so "Users only see only their records" (requires a user field); it "locks down data ... to only be shown to individual users" and is not supported on public interface pages (R1). External reviewers can be invited through Portals; they "will not have the ability to view other external users" and get Editor, Commenter or Read-only access (R2). Fields in the record review layout can be view-only or editable, with custom buttons for actions such as approval (R3).
2. **Scoring.** Built by hand: score and comment fields per application, an evaluators table linked to applications, calculated fields that "take a sum or average" (R4).
   3-7. Blind review, decisions and applicant notification are left to the builder; not documented as features (R4). Typeform-based review is not documented in any source found.

## 11. Agentic AI Build Week 2026 (GenAI Fund, Southeast Asia)

Sources: [AABW 2026 official rules on Devpost](https://agentic-ai-build-week-2026.devpost.com/rules) (B1), [GenAI Fund recap post](https://genaifund.ai/2026/07/29/agentic-ai-build-week-2026-the-largest-buildathon-asean-has-ever-seen/) (B2). The Devpost page title says the event moved to `aitalent.genaifund.ai/hackathon` (B1); that portal shows only a login screen to the public, so nothing about its judging could be read.

1. **Who judges.** "70+ judges" across multiple stations; enterprise partners that brought problems (AWS, Tasco, KFC, VNGGames, Phong Vu, Guardian, Galaxy Holdings, VietJet Air, Shinhan Future's Lab, GoTyme, The Anam) judged alongside other experts (B2).
2. **Scoring.** Six criteria: agentic AI use, problem and track fit, technical execution, impact and usefulness, creativity, pitch performance (B2). The rules only say criteria "will be announced by the organising team prior to the hackathon" (B1). Scale and weights are not public.
3. **Rounds.** "Two full rounds of pitching": panelists narrowed each of 11 tracks to finalists, then shortlisted teams had deeper technical reviews with track owners (B2). Each sponsored track had 60 submission slots (B1).
4. **Decision.** "All judging decisions are final"; the organisers may disqualify submissions that break the rules (B1).
5. **Release.** "Prize winners will be announced at the Award Ceremony on 12 July 2026" (B1), the same day as Demo Day and the submission deadline.
6. **Versions.** Submission deadline 12 July 2026 9:00 AM ICT; "Late submissions will not be accepted" (B1).

## 12. AngelHack

Sources: [AngelHack 2019 Silicon Valley on Devpost](https://angelhack-2019-silicon-valley.devpost.com/) (H1), [How to organize a hackathon (AngelHack blog)](https://angelhack.com/blog/how-to-organize-a-hackathon/) (H2).

1. **Who judges.** Named external judges (marketing manager, startup co-founder, investor, academic) (H1). AngelHack advises recruiting "experts with relevant experience" and briefing judges 48 hours ahead (H2).
2. **Scoring.** "Each submission will be scored in each round" on Fundability, Execution, UI/UX, Originality, Team, 0-5 points each, 0-25 total, "with the final score being the average of the judges' scores" (H1). The blog rubric is five dimensions at 5 points each and suggests adjusting weights to the event's goals (H2).
3. **Assignment.** For many teams, "a bracketed structure: teams present to individual judges first, and only finalists move to the full panel" (H2).
4. **Release.** AngelHack recommends sharing "the full rubric with participants at the opening ceremony, not just with the judges" (H2).

## 13. HackerEarth

No public help-center documentation of HackerEarth's human judging workflow was found. Its help center ([help.hackerearth.com](https://help.hackerearth.com/hc/en-us/articles/360006346933-evaluating-programming-questions)) documents automatic evaluation of coding questions by test cases, which is a different thing. Its challenge pages (for example [AI Genesis judging tab](https://www.hackerearth.com/challenges/hackathon/ai-genesis/custom-tab/judging/)) show tabs for "Evaluation Criteria", "Judges" and "Judging", but the content is loaded by script and could not be read. Product pages describe a reviewer interface and managed judge coordination in marketing terms only ([Hackathons for hiring](https://www.hackerearth.com/recruit/hackathons)). Nothing here is relied on in the patterns below.

---

## Patterns

**Where most platforms agree**

1. **Judges see only what they are assigned.** Devpost (by category or group), Submittable (Levels 1-2, Next Reviewer role), Award Force (judge workspace from panels), Evalato (by category and round), Gust (by pipeline stage), Airtable (current-user filter). Full visibility is an admin role, not a judge default.
2. **External judges are invited by email and get a personal account.** Devpost asks judges to create or log in to an account through a private link; Submittable has reviewers accept and set a password; Award Force uses invite plus password or a six-digit email code; Gust invites by email. No platform documented SSO for judges, and none documented a pure magic link without an account (Evalato's link is documented but not its sign-in).
3. **Several criteria, each on a small numeric scale, combined into an average across judges.** Devpost 1-5 stars per criterion; AngelHack 0-5 per criterion; COPILOT 0-5 with labeled meanings; Award Force and Submittable Next let the organizer set the maximum per criterion. Award Force, Evalato, AngelHack and COPILOT all average across judges; Award Force explains that averages keep abstentions and recusals from penalizing an entry.
4. **Judges do not see each other's scores by default.** Submittable classic says reviewers "only see their own vote"; Award Force shares scores only after the manager turns it on and grants a role permission; Evalato has it as an opt-in per round. Several vendors frame hiding scores as bias prevention (Submittable guide, Award Force lock advice).
5. **Conflict of interest is a judge-initiated decline plus an admin override.** Devpost "I recuse myself"; Submittable Next optional COI question with comment, final and visible to the admin; Award Force judge Abstain vs manager Recuse; Evalato abstain. Declined scores are excluded from averages (Award Force, Evalato).
6. **Organizers track progress per judge** (completed of assigned, percent): Devpost, Devpost for Teams, Submittable Next, Award Force, Submittable classic (votes cast of expected).
7. **A person decides; the computed ranking only orders the list.** Devpost drag-to-winners; Devpost for Teams dropdown sorted by average; Submittable Next Program Owner's Start/Finish Decision; Award Force tags from the leaderboard; COPILOT evaluators "discuss and agree". Evalato ("the candidate with the highest average score is considered the winner") and AngelHack ("the final score being the average of the judges' scores") describe the result as computed; elsewhere a person picks from the ordered list.
8. **Reviews and decisions are separate objects.** Submittable classic keeps status changes from low-level reviewers; Submittable Next separates feedback, Final Decision and award offers; Award Force separates scores from outcome tags.
9. **Entrants do not see individual judges' scores by default.** Evalato is the exception that can publish "individual votes, and comments made by the judges" on a public applications page if the organizer chooses. When feedback is shared it is opt-in by the organizer, anonymized, and usually an average plus selected comments: Devpost for Teams (round average, anonymized comments on the project page), Award Force (average only, "Individual judge scores are never shown to entrants", internal comments never shared), Submittable classic ("Reviewer 1, Reviewer 2", only shareable fields). YC gives feedback only to interviewees.
10. **Most freeze the submission at the deadline.** Devpost does not carry post-deadline edits into the submission; YC disallows continuous editing; AABW rejects late submissions. Later changes go through an explicit organizer action: Devpost late-submission link, Submittable "Open Editing" or "Request Revision", Award Force resubmission. Award Force is the exception: by default entrants edit until the round closes and judges see the live entry.

**Where they differ**

- **Weights.** Not supported on Devpost.com ("does not currently support varying weights"); percentages summing to 100% on Devpost for Teams, Submittable Next and Evalato; a multiplier on Award Force.
- **Editing a saved score.** Devpost.com: allowed from the dashboard. Devpost for Teams: until the organizer ends judging. Submittable classic: locked unless the admin enables editing. Submittable Next: a per-round yes/no, and frozen once the owner starts the final decision. Award Force: editable unless "lock 5 minutes after submission" is on, then only a manager unlocks.
- **Comments.** Optional or required per round or per criterion (Devpost setup, Award Force, Evalato, Submittable Next notes box); Devpost's judge article says stars are the only feedback.
- **Peer score visibility.** Never documented on Devpost; role-based on Submittable; opt-in per score set and role on Award Force; opt-in per round on Evalato.
- **Assignment model.** All judges see everything (Submittable Next option, Award Force role-based panels) vs N reviewers per entry at random (Submittable Next, Award Force random) vs by category or group (Devpost, Evalato) vs by pipeline stage (Gust).
- **Release timing and recall.** Devpost: announce now or schedule; recall not documented. Devpost for Teams: draft vs publish. Submittable Next: nothing reaches applicants until offers are designated or the cycle closes; an offer can be reversed until accepted; closing the cycle is permanent and sends "Not Selected" emails. Live events (AABW) announce on stage the same day.
- **Not-selected state shown to entrants.** Submittable Next shows "Under Review" to both selected and waitlisted until release, then "Not Selected"; COPILOT sends a rejection letter or ESR with an appeal window; Devpost documents only winner banners and an update to all participants.
- **Edits after submission.** Award Force allows entrant edits until the round closes by default and keeps judging entries under resubmission; Devpost freezes the submission at the deadline; Submittable Next marks every admin edit with an "Edited" tag visible to reviewers and keeps an edit log.
