# Import of the Tasco challenge applications from the Lovable page

A one-off move of the applications the challenge's earlier page (built on Lovable) collected into the `insurance-ai-tasco` program, so reviewers read every application in one place and applicants continue on BeyondPilot ([BEY-131](https://linear.app/beyondpilot/issue/BEY-131)). `build.py` reads an export of the page's `applications` table and its `pitch-decks` bucket and writes one SQL file and the files to copy into the storage volume.

## The export

Taken from the Lovable project by its owner; it holds names, email addresses and phone numbers, so it stays in the git-ignored `.tmp/` and is never committed.

| File               | Holds                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `applications.csv` | The `applications` table, semicolon separated                                                 |
| `exclude.json`     | `{"excluded_as_tests": [<application id>, …]}`: the test applications, chosen by reading them |
| `files/<path>`     | Each file of the `pitch-decks` bucket at the path the table names                             |

## What a row becomes

- **Account:** by email address, created when the address has none.
- **Organization:** the one the account is in already, otherwise one made from the team name, in review, with the applicant as owner. Its type comes from the participant type and size.
- **Solution:** a draft of that organization from the product name, pain points, stage, demo link and tools. Live PoC, Pilot Deployment and Beta Release become `pilot`.
- **Application:** contact, team background, traction, tools, the deck, and the proposal PDF as the answer to "Your proposal to Tasco". Proposal description and pilot requirements fill the questions with those labels when the program asks them. A submitted application keeps its first submission time and gets version 1, with the snapshot `ProposalService.snapshot` keeps.
- **Left out:** test rows, and rows where nothing was written. Text longer than the form takes is kept whole.

Identifiers are UUID version 5 of the application's identifier or the email address, so a second run adds only applicants who have no application to the program yet. An application loaded before and changed on the old page since (a later `updated_at`) is brought up to date, with its organization, solution, files and first version, as long as nobody saved it, its organization or its solution on BeyondPilot; one changed on both sides is left as it is here and counted in the closing notice. The load publishes no event, so no email is sent.

## Run

```sh
python -I infrastructure/lovable-import/build.py .tmp/lovable-export .tmp/lovable-import/out
```

It fails, writing nothing, on a value it has no mapping for. `out/build.json` holds the counts only.

## Load into an environment

Staging first. On the host:

1. Dump the database: `docker exec beyondpilot-postgres pg_dump -U beyondpilot -d beyondpilot -Fc > before-lovable-import.dump` (the staging container is `beyondpilot-staging-postgres`).
2. Copy the files: `tar -C out/storage -cf - . | docker exec -i beyondpilot-api tar -xf - -C /var/lib/beyondpilot/storage`.
3. Load: `docker exec -i beyondpilot-postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -f - < out/load.sql`. It runs in one transaction and ends with a notice of what it wrote.
4. Check in Admin › Programs › the program › Applications that the submitted ones are listed, open one and download its files.
