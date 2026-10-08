# Plan: import of the Agentic AI Build Week registrations

Design: [design.md](design.md). Tracked in [BEY-90](https://linear.app/beyondpilot/issue/BEY-90). Branch `dathip04/bey-90-import-aabw-nguoi-co-ve-builder-thanh-ho-so-talent-50-ho-so`.

| Step | What | Done when |
| --- | --- | --- |
| 1 | Script: read and map the file, write the report, no SQL yet | The report on the real file is reviewed |
| 2 | Script: the SQL that writes an account and a hidden profile for each person | It loads into a local database cleanly, and a second load adds nothing |
| 3 | Script: the staging step that approves and lists fifty profiles and suppresses their addresses | The SQL is reviewed |
| 4 | Staging: dump, load, the staging step, rebuild the search index, check the directory, a profile and that an enquiry sends nothing | The counts are on Linear |

Steps 1 to 3 are done (8 October 2026): on the real file the script reads 3,908 rows and writes 2,118 profiles. Against a database built from the migrations, the load wrote 2,118 accounts and profiles, a second load wrote none, a profile deleted by hand came back alone, and the staging step approved and listed fifty and was harmless when run again. Step 4 ran on staging on 8 October 2026, after a dump kept on the host: 2,118 accounts and 2,118 hidden profiles written, fifty approved and listed with their addresses suppressed. The index was rebuilt when staging next started, and search finds the fifty. The directory, the Software engineer chip and a profile were looked at on staging at 1440 and 390. Not exercised there: an enquiry to a shown profile. The code refuses a suppressed address before any queued email is handed over (`EmailService.queue`), but nobody has sent one yet.

## Next

- Production, once GenAI Fund answers whether the profiles may be shown (BEY-41).
- Telling the people that a profile waits for them.
