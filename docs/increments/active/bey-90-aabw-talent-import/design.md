# Import of the Agentic AI Build Week registrations as talent profiles

Status: in progress, 8 October 2026. Tracked in [BEY-90](https://linear.app/beyondpilot/issue/BEY-90); the plan was reviewed by the owner of the talent module in [BEY-86](https://linear.app/beyondpilot/issue/BEY-86). It gives the talent directory of [BEY-36](../bey-36-talent-enquiries-and-review/design.md) its first people.

## Source

The old platform's export holds no people ([import from the old platform](../bey-74-v1-import/design.md#source)). The source is `New AABW registrant data.xlsx`, the registrations of Agentic AI Build Week: one sheet, 3,908 rows, 22 columns. It is a registration form, not a profile: it has no headline, bio, photo, city, languages or kind of work the person is open to.

The file holds names, email addresses and phone numbers, so it is never committed, and the phone number is never read.

## Decisions

1. **A one-off load, not a feature.** As the [import from the old platform](../bey-74-v1-import/design.md#decisions): a script in `infrastructure/talent-import/` reads the file and writes SQL, and the application gains no import module, endpoint or operator method.
2. **Builders only.** A registration becomes a profile when it was approved, holds a builder ticket, and states a name, a job title and a piece of work. A guest ticket came to watch, not to build. A person who registered under several addresses with the same LinkedIn profile gets one profile, from the latest registration.
3. **Hidden until its owner or GenAI Fund decides.** Every profile arrives as a draft that is not listed. The people registered for an event and have not agreed to a page in a directory; whether GenAI Fund lets them be shown is asked in BEY-41. Production shows none of them until that is answered.
4. **Fifty are shown on staging.** A separate step, run on staging alone, approves and lists fifty profiles so the directory is seen with real people. Their addresses are suppressed in staging's email settings first: the sending domain works, so an enquiry would otherwise reach a person who has never heard of BeyondPilot.
5. **An account for each person.** A profile belongs to an account, so the load creates one for each address that has none. The person who signs in with that address, by code or with Google, finds the profile and edits it as their own. The account has no display name until they sign in.
6. **Every value is as the person stated it.** A role is given only when the stated title is that role: a role's own name, or the form's choice that says the same (Developer / Engineer is a software engineer, Student a student, since [BEY-91](https://linear.app/beyondpilot/issue/BEY-91) added the plain roles). Every other title is `other`, and the headline keeps the title. An industry or a country with no code is left empty, never moved to the nearest one. A skill is one of the programming languages or of the models and tools the person chose, the tool named without its list of versions. The one answer about work becomes one project with no year and no stage.
7. **A headline and a bio are made from the answers.** A profile cannot be approved without them and the form asked for neither. The headline is the job title and the company. The bio says, in English, the title and company, the years of work with AI and ML, the track the person chose and that they registered as a builder; nothing they did not state.
8. **A profile its owner can save.** Every value is within the limits of `SaveTalentProfileRequest`, which are stricter than the database's: a profile past one of them would be refused on its owner's first save.
9. **The same file gives the same rows.** Every identifier is a UUID version 5 of the email address, the profiles are written in the order of their addresses, and a second load adds only what is not there yet; it never writes over a profile its owner has edited.

## What is not taken

The phone number, the company's website, the company type, the count of referrals, and the free-text list of other tools.

## Known limits

- The load writes the tables directly: no audit event and no email. The dump taken before it and the report record it.
- A person who registered twice without a LinkedIn link in common gets two profiles.
- About a quarter of the profiles have the role `other`: executives, managers, sales and consultants, whose titles are none of BeyondPilot's roles.
