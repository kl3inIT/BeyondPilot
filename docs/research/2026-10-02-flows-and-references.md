# Flows and references

Written on 2 October 2026 as input for the Figma milestone of 6 October and the live site of 9 October. For each Phase 1 flow: the references studied on Mobbin, and what the team proposed from them. The direction is restrained: real content, no decorative icons, no purple. What was drawn in the end is in the [main-flows increment](../increments/active/bey-27-main-flows-design/design.md).

## A. Directory: solutions, use cases, talent, programs

References: [Jira Marketplace](https://mobbin.com/screens/d8ef5d79-a346-4974-8968-1d25b8b5223e) (a card with logo, vendor, description and trust signals; filters as buttons), [fal](https://mobbin.com/screens/890e0d84-2b19-4268-8c88-a88642bdf9d9) (a left filter with a count per entry; "Showing 28 of 1400"), [Relevance AI](https://mobbin.com/screens/32b88167-1a97-4fbd-8707-340cf80defb8), [Behance](https://mobbin.com/screens/386fd823-75f9-4187-a049-d85696bd615e).

Proposed:

- One directory template for all four kinds: search, filters, sorting, a result count and a card grid.
- With about 2,500 solutions, chips alone are not enough: filters need counts, and on a phone they open in a sheet.
- A compact card: logo, name, organisation, one line of description, two or three tags and a status badge.
- The filters live in the URL, so a filtered list can be shared.

## B. Solution and organisation detail

References: [Wellfound company](https://mobbin.com/screens/28060775-da8b-4a37-85a0-7a78869a86d7) (tabs and an information column on the right), [Contra](https://mobbin.com/screens/af5e9c35-9f77-4eed-bc51-3d2ee0dd5934), [Attio record](https://mobbin.com/screens/f6750bef-6bce-435c-8460-3c55f32f1254).

Proposed: a header with logo, name, organisation and maturity; a body with overview, case studies, offers, deck and demo; an information column with website, headquarters, funding, size and industries; "Contact" for everyone, and "Invite to propose" for an enterprise.

## C. Talent

References: [Upwork](https://mobbin.com/screens/70d608a5-1a3c-43fa-b8a8-ba0d65d8a70f) (a profile opens as a panel over the list), [Braintrust](https://mobbin.com/screens/cc759492-4fdc-41bf-97f9-5c6a3a18d135), [Dribbble](https://mobbin.com/screens/34265766-9226-4645-9e4d-070e442fb234) (an enquiry form with the project, the timing and the budget), [Fiverr](https://mobbin.com/screens/b9663439-bdd6-4ad3-afa2-5babf213ce71).

Proposed: a profile with a headline, skills, past projects, availability and region; contact through an enquiry form, never by showing an email address.

## D. Programs and campaign pages

References: [Contra hackathon](https://mobbin.com/screens/c7fda5c2-51fb-408a-8529-3de3ac4fe737) (prize, countdown, judges in a right column, a guidelines tab), [Kraken challenge](https://mobbin.com/screens/cf44b628-1340-41bb-bdca-1061512c10ad) (steps to take part and an FAQ), [Later campaign](https://mobbin.com/screens/b16cc4f1-c387-4e5c-b1f5-5d5ecfd7607d) (the campaign on the left, the form on the right).

Proposed: one campaign template filled with the Tasco challenge: a hero with the partner, the deadline and Apply; the problem and the directions; timeline, eligibility, judges and mentors, FAQ; an Apply action that stays in view while scrolling.

## E. Sign-in

References: [Lemni](https://mobbin.com/flows/5040dbbc-e748-4547-8368-57eb1cc40bea) (Google and an email field on one screen, then "Check your inbox" with a resend), [Amplitude](https://mobbin.com/flows/d16caed9-80ef-4c88-a085-e7b40e9b197a), [Hashnode](https://mobbin.com/flows/0d4547cd-f4c3-47c9-b6b0-df7643691c8a).

Proposed: one screen with "Continue with Google" or an email link; a "check your inbox" screen with resend, change of email and a reminder about spam; no password; after signing in, the person returns to the application they started.

## F. Application

References: [Deputy](https://mobbin.com/flows/39b243dd-d98c-4a7b-aa0a-53598cee249f) (steps in a left column, file upload, review, "All submitted"), [Braintrust](https://mobbin.com/flows/06fe98c4-06f1-428c-a482-ab109dec378a) (one page with a sticky send action), [7shifts](https://mobbin.com/flows/0254fd4e-48a3-4a1f-8ecc-d74903b2dde1).

Proposed: several steps listed at the side, a draft that saves itself, a review step and a confirmation; the program or use case always in view; fields filled from the solution profile; "My applications", editable until the deadline.

## G. Review, shortlist and matching

This is where the two gaps of the old platform are closed: an operator could not add a candidate by hand and could not remove a wrong match.

References: [Pin](https://mobbin.com/screens/43ceb1a1-05bb-48a2-96b2-d13dee47d299) (shortlisted and manually added lists; outreach, shortlist and decline per candidate), [Wrangle](https://mobbin.com/screens/0ba37113-799b-4609-b80b-9848197afc25) (sourcing, shortlisted and hidden tabs; a checklist of criteria that explains each match; remove), [Workable](https://mobbin.com/screens/51561265-dac0-4ea4-8cbf-c49161f670d4) (a label for where a candidate came from; "Search with AI" beyond the pool), [Homerun](https://mobbin.com/screens/80dfe542-7c1b-4303-a449-b4f465d615fe) and [Wellfound](https://mobbin.com/screens/d8074512-4c40-4f5c-8230-172582c160b8) (columns per stage, "Add candidate").

Proposed: each use case has one candidate list that gathers four sources, each candidate labelled with its source: applied; matched in the database; found by web research; added by GenAI Fund. Each candidate shows why it matches, as criteria met or not met, and takes three actions: shortlist, dismiss (with a reason, reversible) and request information. The internal state (new, reviewing, shortlisted, declined) is separate from the outcome the applicant is told.

## Screens proposed for 6 October

Home; solutions list and detail; use cases list and detail; talent list, detail and enquiry form; programs list and the Tasco campaign page; sign-in and "check your inbox"; the application steps, review, submitted and "My applications". The candidate list, matching and administration come after, with the AI milestone.

## Questions this raised

- Who creates an offer, the provider or GenAI Fund, and what does claiming one mean?
- Is voting on use cases kept?
- Does a use case's budget stay hidden until sign-in?
- Can an enterprise stay anonymous on a use case?
- Is messaging between an enterprise and a provider part of Phase 1?
- Does a person whose email matches an accepted domain join the organisation without an invitation?

The questions about scope are tracked in Linear (BEY-23, BEY-24, BEY-25). The others are the team's to decide in the design.
