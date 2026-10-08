# Plan: import of the Agentic AI Build Week registrations

Design: [design.md](design.md). Tracked in [BEY-90](https://linear.app/beyondpilot/issue/BEY-90). Branch `dathip04/bey-90-import-aabw-nguoi-co-ve-builder-thanh-ho-so-talent-50-ho-so`.

| Step | What | Done when |
| --- | --- | --- |
| 1 | Script: read and map the file, write the report, no SQL yet | The report on the real file is reviewed |
| 2 | Script: the SQL that writes an account and a hidden profile for each person | It loads into a local database cleanly, and a second load adds nothing |
| 3 | Script: the staging step that approves and lists fifty profiles and suppresses their addresses | The SQL is reviewed |
| 4 | Staging: dump, load, the staging step, rebuild the search index, check the directory, a profile and that an enquiry sends nothing | The counts are on Linear |

## Next

- Production, once GenAI Fund answers whether the profiles may be shown (BEY-41).
- Telling the people that a profile waits for them.
