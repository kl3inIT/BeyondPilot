# Import from the old platform

A one-off load of GenAI Fund's v1 export (startups and use cases) into BeyondPilot, as decided in the [import design](../../docs/increments/completed/bey-74-v1-import/design.md). `report.py` reads and reconciles the export. `build.py` writes the duplicate-protected `load.sql`, a targeted `v1-details.sql` refresh for rows from an earlier load, and the files needed by the database's local object store.

| File                                     | Holds                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vocabulary.py`                          | The codes BeyondPilot accepts, copied from the backend                                                                                                                                                                                                                                               |
| `check_vocabulary.py`                    | Fails when `vocabulary.py` no longer matches the backend                                                                                                                                                                                                                                             |
| `mapping.py`                             | Maps controlled v1 values to BeyondPilot codes; reports unsupported codes and leaves descriptive company claims as statements                                                                                                                                                                        |
| `report.py`                              | Reads the export and writes the report                                                                                                                                                                                                                                                               |
| `records.py`                             | The organizations, solutions, use cases and file references the export becomes, including the v1 solution-detail fields                                                                                                                                                                              |
| `fetch.py`                               | Fetches a file from v1's API or Google's public download addresses only, checks its type and size, and caches it                                                                                                                                                                                     |
| `build.py`                               | Writes `load.sql`, `v1-details.sql` and the files in the local object store's layout                                                                                                                                                                                                                 |
| `enrich_fetch.py`, `enrich_render.py`    | Enrichment stage 1: each startup's deck text, website pages and logo and cover candidates; pages built by JavaScript and SVG logos read in headless Chromium                                                                                                                                         |
| `enrich_check.py`                        | Keeps a researched value only when its quote is in the saved source and the value is a code BeyondPilot accepts                                                                                                                                                                                      |
| `enrich_apply.py`                        | Writes `update.sql` (empty parts filled, customers added) and `audit.sql` (one `solution.enrich` event per solution, with each value's quote and source)                                                                                                                                             |
| `enrich_images.py`                       | Writes the found logos and covers into the object store's layout and `images.sql`                                                                                                                                                                                                                    |
| `usecase_extract.py`, `usecase_check.py` | Fill the imported use cases' empty fields from their v1 briefs, and approve them                                                                                                                                                                                                                     |
| `passages.py`                            | Writes `passages.sql`: the saved website text of each imported solution as the passages search keeps for matching, without the lines every page of a site repeats                                                                                                                                    |
| `enterprises.py`                         | Reads the `enterprises` sheet of the full export and writes `enterprise-profiles.sql`, which completes the organizations the use cases' load made from a name and an industry, and `enterprise-organizations.sql`, which creates the organization of each enterprise that has people and no use case |

## Run

From the repository root, with Python 3.12 or newer:

```sh
python -m venv .tmp/legacy-import/venv
.tmp/legacy-import/venv/Scripts/python -m pip install -r infrastructure/legacy-import/requirements.txt
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/check_vocabulary.py
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/report.py <export.xlsx> .tmp/legacy-import/out
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/build.py <export.xlsx> .tmp/legacy-import/out .tmp/legacy-import/cache
```

The build fetches each file once into the cache, so a second run fetches nothing.

`-I` keeps Python from loading modules from the current directory. On Linux and macOS the interpreter is `venv/bin/python`.

## Outputs

- `summary.md`: counts only. It may go on Linear.
- `report.md`: names companies, test records and duplicates. It stays on the machine that ran it.
- `load.sql`, `v1-details.sql`, `files/` and `build.json`: the initial load, the targeted refresh and what was fetched or refused. They hold the export's content and stay with it.

The export, both reports and anything produced later from them are never committed: they hold names and email addresses. `.tmp/` is ignored by Git.

## Load into an environment

Staging first, then production, with the same `load.sql` and `files/` (the [design](../../docs/increments/completed/bey-74-v1-import/design.md), decision 4). On the host, from the environment's directory:

1. Dump the database: `docker compose exec -T postgres pg_dump -U beyondpilot -Fc beyondpilot > before-legacy.dump`.
2. Copy the files into the object store, keeping their paths: `docker compose cp files/. api:/var/lib/beyondpilot/storage/`, then make them the api user's (`docker compose exec -u root api chown -R 1654:1654 /var/lib/beyondpilot/storage`, the uid of `backend/Dockerfile`).
3. Find the operator account: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -tAc "select id, email from identity_account where platform_role = 'operator'"`.
4. Load: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -v operator=<id> -f - < load.sql`. It runs in one transaction and ends with a notice of what it wrote; a second run of the same export is refused and changes nothing.
5. Approve the imported organizations and approve and list every imported solution, so matching is built on real data: `python -I infrastructure/legacy-import/staging_list.py .tmp/legacy-import/out/load.sql > .tmp/legacy-import/out/staging-list.sql`, then run it with `psql -v ON_ERROR_STOP=1 -f -`. Production ran it too on 13 October 2026 (design, decision 3); rebuild the search index after it.
6. Rebuild the search index from Admin › AI › Search index.
7. Check the counts against `build.json` and the summary, and in Admin › Organizations and Solutions (Approved on both since 13 October 2026).
   For an environment loaded before the detail columns were added, generate the current `v1-details.sql` from the same workbook and apply it after migrations V60 and V61. It updates only the imported company-size label and startup detail fields on deterministic v1 ids, including moving `Notable Paying Customers` out of `traction` and `Key Milestones` into it. It does not rerun the duplicate-protected load or alter review status or operator backing.

## Enrich

After the load, empty parts of the imported records are filled from public sources: the startup's deck, its website and, when the site is missing or dead, a web search. Nothing already there is overwritten, except the summary v1 generated ("Company founded in … focusing on: …"). A value is stored only with a verbatim quote from a saved source, and the quote goes to the audit log, which only operators read; nothing new is published about where it came from.

1. Stage 1, no AI: `enrich_fetch.py <input.json> <work>`, then `enrich_render.py <input.json> <work>` for what needs a browser (`playwright install chromium` once).
2. Stage 2, research: an agent per batch reads only the saved files, checks the site is still the same company, and writes `results/<id>.json`: for each value it fills, the quote and the source file.
3. Stage 3: `enrich_check.py <work>`, then `enrich_apply.py <work> <out>`. Dump the database, run `update.sql`, then `audit.sql` once the application knows the `solution.enrich` action, and `images.sql` from `enrich_images.py` after copying its files like step 2 of the load.
4. Use cases: `usecase_extract.py <export.xlsx> <work>` and `usecase_check.py <work>`; run `update.sql`, then `approve.sql`.
5. Rebuild the search index.

The work folders hold the companies' pages and decks: they stay under `.tmp/` and are never committed.
| `enterprise_logos.py` | Fetches the logos the `enterprises` sheet names and writes `enterprise-logos.sql` and the files, for the organizations that have no logo |
| `people.py` | Reads the `representatives` sheet and writes `startup-invitations.sql` and `enterprise-invitations.sql`: an operator's invitation for each person who is surely of a company, to the organization the load made for it, with nobody's account created and no email sent |
| `duplicates.py` | Writes `duplicates.sql`, which merges the organizations the old platform holds twice into one, as the application's merge does it, and refuses their duplicate solutions as duplicates |

## People and enterprises of the full export

GenAI Fund's full export of 8 October 2026 (`genai_platform_full_db_export_2026-10-08.xlsx`, 13 sheets named as the database's tables) adds the enterprises' profiles and who belongs to which company ([design](../../docs/increments/completed/bey-74-v1-import/design.md#the-full-export), BEY-147). It is loaded in small steps, each on staging first and reported before the next.

1. Enterprise profiles: `python -I infrastructure/legacy-import/enterprises.py <full-export.xlsx> <out>` writes `enterprise-profiles.sql` and prints the counts. On the host, after a dump: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -f - < enterprise-profiles.sql`. It runs in one transaction, fills only what is empty on an organization that exists, and ends with a notice of how many it completed; a second run completes none.
2. Missing organizations: the same run writes `enterprise-organizations.sql`. After a dump, load it with the operator account, as `load.sql`: `psql -v ON_ERROR_STOP=1 -v operator=<id> -f - < enterprise-organizations.sql`. It creates, in review and with no member, the organization of each enterprise that has people and no use case, the one with the most people first. An enterprise whose name or website an organization already has is not created. It ends with a notice of the counts and the list of what it did not create and why; the list names companies and stays with the export. A second run creates none.
3. Logos: `python -I infrastructure/legacy-import/enterprise_logos.py <full-export.xlsx> <out> <cache>` fetches each logo by the rules of `fetch.py` and writes `logo-files/` and `enterprise-logos.sql`. Copy the files into the object store as in step 2 of the load above, then run the SQL with the operator account. A logo is named only on an organization that has none, and a file no organization took is removed again. On the export of 8 October 2026, 28 enterprises name a logo: 12 were fetched, 10 are not public on Google Drive and 6 are addresses the load does not fetch.
4. People: `python -I infrastructure/legacy-import/people.py <full-export.xlsx> <out>` writes `startup-invitations.sql` and `enterprise-invitations.sql` and prints the counts. After a dump, run the startups' file, then the enterprises', each with the operator account. A person whose address is on their company's own website domain gets an open invitation to its organization that does not lapse; the person who signs in with the address sees it and accepts. An address on a public mail service or another domain gets none, nor does one that belongs to an organization already or is an operator's. The people of an enterprise that step 2 did not create are invited, as members, to the organization that stands for it. Each file ends with a notice of the counts and the reasons, as counts, for what it did not write. A second run writes none. To take the load back before anyone accepted: `delete from organization_invitation where sent_by_operator and status = 'pending' and expires_at > now() + interval '50 years'`. On the export of 8 October 2026 and staging: 1,242 invitations for 1,545 people of startups and 326 for 535 people of enterprises.

## Duplicates

A company that registered several times on the old platform, or once there and once here, became several organizations, each with its own solution ([design](../../docs/increments/completed/bey-74-v1-import/design.md), decision 18, BEY-156).

1. `python -I infrastructure/legacy-import/duplicates.py <full-export.xlsx> <out> [<same-company.json>]` writes `duplicates.sql`. After a dump, run it with the operator account.
2. Rebuild the search index from Admin › AI › Search index. The rebuild takes about a minute and answers only when it is done; start no matching run before the page says it was rebuilt.

What it does:

- **One company.** Organizations with one name, read without its legal form, are one company when they have one website domain among them, which at least one names. Those with different domains are merged only when the name is in `same-company.json`, written by a person who looked at the websites: `{"<name key>": {"website": "<the one to keep, or null>", "several": <true when the records are different products>}}`. The file names companies and stays with the export.
- **The one kept.** An approved one before another, then the one whose solution has a deck, then the one active on the old platform, then the fuller record, then the one updated last there. The others go into it as the application's merge moves them, members included, and stay with the status `merged` and where they went. The kept one takes a website when it has none, or the one the person chose.
- **The solutions.** Those with one name under the kept organization are one product: the best stays and the others are refused with the reason `duplicate`, never deleted. Taking them off the list would not do, since search and matching read an approved solution listed or not. Where the person found different products of one company, every solution stays. A matching result on a refused solution is removed unless a person decided or answered on it.
- **Left for a person.** A group in which a member has signed in: the application's merge tells the people it moves, and this file sends nothing.

It ends with a notice of the counts. A second run changes nothing. On staging, 12 October 2026, in three runs: 155 organizations merged, 131 solutions refused as duplicates; 34 of the merged names came from `same-company.json`, 9 of them with several products; three names with different websites were left (two different companies, two test records, two that may be related).

## Passages for matching

Matching reads what a solution's own material says ([design](../../docs/increments/completed/bey-39-matching/design.md)). The website text the enrichment saved is loaded once; the application reads decks and customer cases itself.

1. `python -I infrastructure/legacy-import/passages.py <work> <out>` writes `passages.sql` and `passages.json` (the counts). On the export of 4 October 2026: 11,957 passages from 4,210 pages of 1,903 solutions, a fifth of the text left out as menus and footers.
2. On the host, after a dump: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -f - < passages.sql`. It runs in one transaction, keeps only the passages of solutions that exist, and ends with a notice of what it kept. Running it again replaces what it loaded before.
3. The passages are embedded by the job that embeds the index, 64 a minute by default (`beyondpilot.search.embedding.passage-batch-size`).
