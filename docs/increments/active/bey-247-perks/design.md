# Perks, claimed on BeyondPilot by the teams they are for

Status: accepted on 23 October 2026 and being built ([plan](plan.md)). Tracked in Linear as BEY-247, under BEY-34. The research behind it: [Perks](../../../research/2026-10-23-perks.md). It replaces the offers of [a solution comes with offers](../bey-148-solution-offers/design.md) (BEY-148), [an offer is closed to new solutions](../bey-158-offer-close-and-record/design.md) (BEY-158) and [an offer belongs to the organization that gives it](../bey-217-offer-belongs-to-its-organization/design.md) (BEY-217). Winners as an audience are BEY-248.

## The problem

Kai Yong asked on 23 October that the perks GenAI Fund runs on Builder Hub come to the solutions part of beyondpilot.ai. Joshua Si described a perk: steps and terms, a way to claim it (a form, a voucher code, a sign-up), dates it is active between, and an audience, some perks being only for a program's shortlist or winners, some for its registrants, some for everyone.

An offer today is a line of 80 characters and a link, owned by an organization and shown on its solutions' cards. It has no steps, terms, dates or audience, and anyone who opens the link takes it. A perk meant for one program's shortlist cannot be given on BeyondPilot, and a team that took a code has nowhere to find it again.

## What changes

1. **Perks belong to AI solutions.** Kai asked on 24 October for no separate Perks tab: the directory of AI solutions gains a Perks filter, With active perks, that keeps the solutions going with an open perk, with or without a search, and a search finds a solution by the words of its perks. `/solutions/perks` opens the directory with the filter on. So a perk is published only when it goes with a solution of its organization, or shows on a program's page; a new perk of an organization with one solution goes with it from the start. Each perk has a page at `/solutions/perks/{slug}`, its breadcrumb leading back to AI solutions, laid out as a solution's: what it is, who can get it, how to get it, its terms, and a panel to get it. Anyone reads every published perk and who it is for. A perk still shows on the cards and pages of the solutions it goes with.
2. **A perk is for an audience, and the audience is checked.** Everyone; members (signed in and in an organization); the applicants of a program; the shortlist of a program once its outcomes are released. A code, a private link or a form opens only to those who qualify; the others see the perk, who it is for and why they cannot get it.
3. **Four ways to get a perk.** A link to the partner's site; a code GenAI Fund holds for the audience; a code of the team's own, from a list the partner gave; a request, answering the partner's questions. A request perk has a Require approval switch: on, the partner grants or declines each request; off, a request is granted when it is sent.
4. **Limits and places.** A perk is got once per organization (the default) or once per person. A code-list or request perk may have a number of places; when they are taken it shows No places left, and a declined request gives its place back. A code list ends with its last code.
5. **Dates.** A perk shows from its start and ends after its end, in Vietnam time. An ended perk leaves the catalogue unless Show ended is chosen; its page stays, marked Ended, and cannot be got.
6. **A program's page shows its perks.** A Perks section lists the perks for that program's applicants or shortlist, and any other perk an operator adds there, each marked open to the viewer's team or not yet.
7. **A team finds what it got.** My organization gains a Perks tab. Perks you got lists what anyone in the organization took: the code, or the request and its state, who took it and when. Perks you give lists the organization's own perks, with what has been taken and how many requests wait; each opens to its details and its requests, granted or declined there and downloaded as CSV.
8. **The partner publishes.** A member of the organization that gives a perk writes it as a draft and publishes it; there is no review, as on Builder Hub. An operator writes and changes any organization's perk, sets "Arranged by GenAI Fund", loads code lists and adds a perk to a program's page, in Admin › AI solutions › Perks.
9. **Email.** A person whose request is granted or declined is told; an organization's members are told when a request waits for them, and GenAI Fund's operators are told when GenAI Fund arranged the perk or the organization has no member to answer it, as for the Builder Hub partners GenAI Fund entered.

## Domain story

1. Tencent Cloud's partner manager and GenAI Fund agree on 100 RTC vouchers for the teams shortlisted in the Tasco challenge. An operator writes the perk for Tencent Cloud: $100, shortlisted in the Tasco challenge, a code of the team's own, once per organization, until 30 November; loads the 100 codes; sets Arranged by GenAI Fund; publishes.
2. The perk shows in the catalogue and in the Perks section of the Tasco page, marked For the shortlist.
3. Linh at Kyanon Digital opens it. Kyanon was shortlisted and the outcomes are released: Get your team's code shows one code and keeps it against Kyanon. 99 are left.
4. Hùng, also at Kyanon, opens the perk a week later and sees the code Linh took, with her name and the day.
5. Minh at Ollie AI, not shortlisted, sees the perk and that it is for the shortlist; nothing to take.
6. Kyanon writes its own perk, a free two-week AI readiness assessment for members, by request with Require approval on and 20 places, and publishes it. Thu at Fintrace answers its two questions; Kyanon's members are emailed; one of them grants it; Thu is emailed and sees Granted on the perk and in My organization › Perks.

Failures: a person signed out is asked to sign in; a person in no organization is told a perk needs one; a team already holding the perk sees what it holds; the last code or place taken by someone else a moment before answers No places left; a perk ended or unpublished between opening and asking answers it is no longer available; a code list empty answers No places left, and the codes left show to the operator and the partner; a team whose request was declined sees the decline and does not ask again.

## Glossary

| Term                   | Meaning                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Perk                   | What an organization gives to members of BeyondPilot: credits, a free plan, a discount, a service. Called an offer before this increment |
| Partner                | The organization that gives a perk. Any organization may give one                                                                        |
| Audience               | Who may get a perk: everyone, members, a program's applicants, a program's shortlist                                                     |
| Way to get it          | Link, shared code, code list, or request                                                                                                 |
| Claim                  | One getting of a perk by a person for their organization: a link opened, a code shown, or a request sent. Kept with who, when and what   |
| Request                | A claim through the partner's questions; waiting, granted or declined                                                                    |
| Code list              | The single-use codes a partner gave for one perk, each given to one claim                                                                |
| Places                 | How many claims a perk takes, beside its limit per organization or person                                                                |
| Arranged by GenAI Fund | A mark an operator sets on a perk GenAI Fund negotiated                                                                                  |

"Claim" is the record's name in the code; the interface says get, take and request, as Builder Hub's does.

## Data and invariant owner

**New module `perk`** owns every perk and claim: `perk` (the former `offer`), `perk_solution` (the former `solution_offer`), `perk_program`, `perk_code` and `perk_claim`. It owns the rules: who qualifies, the limit, the places, the dates, which code a claim gets, and who may change a perk. Nothing else writes these tables.

| Rule                                          | How it holds                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| One claim per organization, or person         | Checked with the perk row locked (`select … for update`), so two members asking at once cannot both get it                  |
| Places and codes                              | Counted under the same lock: claims not declined; a code is taken with `for update skip locked` and bound to the claim      |
| Audience                                      | Read at the moment of the claim from `proposal` and `organization`; a claim once made stays when the audience later changes |
| A code or private link is not public          | The public projection of a perk never holds them; the claim answer and the team's own list do                               |
| A perk goes only with its partner's solutions | Checked through `solution`'s published API when the solutions are chosen                                                    |

**`proposal` publishes one read**, the standing of an organization (or of a person with none) in a program: applied (an application submitted and not withdrawn), shortlisted (shortlisted and the program's outcomes released), or neither. Nothing about scores or decisions before the release leaves it.

**`solution` loses offers.** Its card and page no longer carry them; the editor no longer picks them. A perk names its solutions in its own form.

## Context map

```text
perk ──► solution       which solutions a perk may go with (sync)
     ──► proposal       standing in a program (sync)
     ──► program        a program's name and slug, for audience and placement (sync)
     ──► organization   the partner, membership of the claimant, OrganizationMerged (sync listener)
     ──► identity       the actor, operator role
     ──► notification   request waiting, granted, declined
     ──► audit          every change of a perk, a code load, a decision
search ──► perk         PerkChanged (async listener) rewrites the cards of the perk's solutions; the perks of a solution for its card
```

No cycle: none of `solution`, `proposal`, `program`, `organization`, `identity`, `notification` or `audit` depends on `search` or `perk`. `perk` is closed; its root holds `PerkChanged` and the read `search` uses. Allowed dependencies: `audit`, `identity`, `notification`, `organization`, `program`, `proposal`, `solution`, `shared`. `search` adds `perk`.

The directory's cards without a search term are read from `solution`, which knows no perks; the web asks `perk` for the perks of the solutions on the page, one request. With a search term the cards come from the index, which carries the perk line as it carries the offer line today.

## Decisions

| Topic                   | Decision                                                                                                           | Why                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A module of its own     | `perk`, with offers moved out of `solution`                                                                        | Checking an audience needs `proposal`, which depends on `solution`: in `solution` it would be a cycle. A perk has its own actors (claimants, partners), lifecycle and private data |
| The word                | Perk, in the interface, the API, the tables and the audit codes; old audit rows keep their `solution.offer_*` actions | Kai, Joshua and Builder Hub say perk; "offer" also reads as a sales offer beside proposals. The audit log is append-only, so its old rows stay as recorded. Đạt, 23 October                                                                        |
| Audience checked        | A code, private link or form opens only to those who qualify                                                       | A perk for a shortlist is worth something only if others cannot take it; AWS asks that its Org ID is not shared. Builder Hub checks only on a form. Đạt, 23 October                |
| Shortlist after release | A team counts as shortlisted only once the program's outcomes are released                                         | Before the release the decision is internal                                                                                                                                        |
| Code list               | Single-use codes loaded by an operator as CSV, one per claim; the codes left show in both lists of perks           | The practice for codes of value: one leaked code costs one place. No email warns of a low stock: no published read names the operators to write to                                                                                                                   |
| Require approval        | A switch on a request perk, off granting at once                                                                   | Luma's switch; Builder Hub's OpenAI form fulfils automatically. Đạt, 23 October                                                                                                    |
| Limit                   | Per organization by default, per person when the partner says so                                                   | Programs for startups count per company (AWS, YC, Brex, Apollo); per person suits a personal plan. Đạt, 23 October                                                                 |
| Places                  | Optional on a code-list or request perk; a declined request frees its place                                        | Builder Hub's quantity. A link perk is got on the partner's site and cannot be counted                                                                                             |
| Ended perks             | Out of the catalogue unless Show ended; the page stays, marked Ended                                               | A shorter catalogue, and old links still work. Đạt, 23 October                                                                                                                     |
| No review               | A partner publishes its own perk; it shows without the mark; an operator corrects, archives or deletes one         | Builder Hub publishes without review; the repository has been removing reviews (`V109__organization_drop_review`). Đạt, 23 October                                                 |
| The mark                | Only an operator sets Arranged by GenAI Fund, and only an operator changes a perk that carries it                  | Kept from BEY-217                                                                                                                                                                  |
| A team's claims         | In My organization › Perks, shared by the organization                                                             | Builder Hub, Devfolio and the fund platforms all have one; the limit is per organization. Đạt, 23 October                                                                          |
| Program page            | Perks for its applicants or shortlist show by themselves; an operator adds others (`perk_program`), shown by title | Builder Hub places perks in campaigns. Đạt, 23 October                                                                                                                             |
| Closing                 | `closed_at` goes. A perk is draft, published or archived, with dates and places                                    | BEY-158 closed an offer to new solutions; a perk now names its own solutions, and dates and places say when it stops                                                               |
| Plain text              | About, the steps and the terms are plain text; the steps an ordered list of up to ten                              | Enough for every Builder Hub perk read; rich text can come later                                                                                                                   |
| Who edits               | The organization's members who may edit its solutions, and operators                                               | The rule offers follow today                                                                                                                                                       |
| A declined request      | Final for that team: the claim stays declined, frees its place, and the team does not ask again | The partner answered; asking again until granted would turn a decision into a queue |
| An archived perk        | Off the catalogue and its page, except for the teams that got it, who still read what they hold | What a team got stays with it, as Builder Hub's claimed list does |
| Who answers a request   | A member of the partner, or an operator for a partner nobody answers for | An operator writes perks for partners nobody has signed in for |

## What a perk holds

Title (up to 80), slug, the partner, value (up to 40, the figure the card shows large), summary (up to 200), about (up to 4,000), steps (up to ten, each up to 300), terms (up to 4,000) and an https terms address, audience and its program, way to get it with its address (https), its shared code and the address to redeem it, its questions (up to five, each a label, short or long text, required or not), Require approval, limit, places, starts and ends, the mark, its solutions, state (draft, published, archived), version and times.

A claim holds the perk, the organization, the person, the code it got, the answers, the state (taken, waiting, granted, declined), who decided and when, a version and times.

## The offers that exist

The migration renames `offer` to `perk` and `solution_offer` to `perk_solution`, and fills the new columns of each existing offer: published, for everyone, a link to its address, once per organization, no value, a slug from its organization and title. A closed offer stays published on the solutions it went with. Audit rows keep their `solution.offer_*` actions. Production had no offer on 18 October; staging holds three.

## Not in this increment

- Winners and top five as audiences (BEY-248).
- Stage-based tiers, as Founders Hub has.
- Counting who opened a perk or followed its link; a link perk shows no count.
- Rich text, a logo of the perk's own (the partner's logo is used) and the moderation Builder Hub applies to it.
- Importing Builder Hub's perks through code: they are entered after the release, with values shortened ("$10").

## Known limits

- A shared code, once shown, can be passed on by the team that got it.
- A link perk for everyone is followed without a record; its limit cannot hold.
- A partner's own perk is public as soon as it is published; an operator who sees a wrong one archives it.
