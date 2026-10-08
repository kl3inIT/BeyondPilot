# The roles of a talent profile

Written on 8 October 2026 for BEY-91. The question: a talent profile takes its roles from ten codes, all of them AI specialisms, and when the registrations of Agentic AI Build Week were mapped to profiles (BEY-90) every one of 2,118 people fell under `other`. Should `other` carry the role as text, or should the list change?

## What was read

| Source | What it shows |
| --- | --- |
| LinkedIn's [job function codes](https://learn.microsoft.com/en-us/linkedin/shared/references/reference-tables/job-function-codes) (Microsoft Learn, read 8 October 2026) | 35 functions, broad and neutral: Engineering, Information Technology, Research, Consulting, Education, Product Management, Design, with one `Other`. No function carries text |
| LinkedIn's profile, from the team's knowledge of the product; not opened again for this note | The headline and each position's title are free text. The function and seniority a search filters by are not typed by the person: LinkedIn derives them from the title |
| A.Team's [role pages](https://www.a.team/talent/roles/forward-deployed-engineer) (read 8 October 2026) | A marketplace of AI talent lists AI specialisms beside plain engineering roles: forward deployed engineer, AI engineer, AI architect, fullstack engineer, DevOps engineer. A card shows a name, a title and years of experience |
| GenAI Fund's prototype, [browse talent](captures/prototype/proto-browse-talent.txt) | Three chips: Forward-deployed engineers, AI engineers, Automation specialists |
| The brief, [§7.9](../brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#79-ai-talent) | Asks for search and filter of talent; names no list of roles |
| The registrations of Agentic AI Build Week, as BEY-90 maps them | Of 2,118 builders: Developer / Engineer 626, Student 481, Entrepreneur (Founder/Co-Founder) 344, Academic / Researcher 113, Solution or Systems Architect 35; the rest are executives, managers, sales and consultants |

The role lists of Wellfound, Toptal and Braintrust were looked for and not found in a public source, so nothing here rests on them.

## What it says

- **What a person calls themselves and what a list filters by are two things.** LinkedIn keeps the first as free text (headline, title) and the second as a short fixed list the person never types into. BeyondPilot already has both: the headline is the free text, the roles are the list. Text on `other` would be a second headline that no filter can read.
- **A list to filter by has to be broad enough that most people are in it.** LinkedIn's functions are; BeyondPilot's roles were not, for the builders GenAI Fund's own events bring: three quarters of them are software engineers, students, founders, researchers and architects.
- **AI specialisms and plain engineering roles sit in one list** on a marketplace that sells AI talent.

## What follows

Five roles join the ten: `software_engineer`, `solution_architect`, `researcher`, `founder` and `student`. `other` stays a code without text. Recorded in the [talent design](../increments/active/bey-36-talent-enquiries-and-review/design.md#decisions), decision 16.

Left for later: a role proposed from the headline and the projects by AI and confirmed by the person, as LinkedIn derives a function from a title.
