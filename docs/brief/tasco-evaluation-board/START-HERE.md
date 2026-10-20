# Tasco Evaluation Board — Developer Handoff

> **Repository note (20 October 2026):** received from Kai Yong on 20 October 2026 for BEY-230. This repository is public, so only the methodology and the data-free `template.html` are kept here. `index.html`, `mockup-data.json`, `build_html.py` and `validation.json` hold evaluations derived from real Tasco submissions; they stay with the team, outside Git (a local copy sits in the git-ignored `.tmp/tasco-evaluation-board/`).

## Start here

Open `index.html` directly in a browser. It is the complete working reference: no installation, server or backend is required.

This is an evaluation board for the operator to review candidates and decide whom to shortlist. It must not automatically shortlist, decline or send outcome notifications.

## Included files

- `index.html`: working evaluation board with embedded presentation data.
- `template.html`: editable HTML, CSS and JavaScript, with a data placeholder.
- `mockup-data.json`: 48 retained evaluations and per-finding evidence labels for the reference UI.
- `build_html.py`: optional Python 3 helper to rebuild index.html from the template and JSON. Run `python3 build_html.py` in this folder.
- `validation.json`: checks performed and verification limitations.
- `shortlisting-methodology.md`: agreed use-case-based evaluation methodology and developer requirements.
- `evaluation-methodology-detailed.md`: fuller methodology, evidence review requirements and evaluation template.

## Agreed experience

1. Show all evaluated candidates by default, alphabetically.
2. Keep the overview to company/solution, system assessment, why consider and main concern.
3. Click a row to open six short findings and a next step.
4. Click an individual finding or evidence badge for detail, qualifications and source references.
5. Preserve search, tier/alignment filters, clarification filter and an evidence-label glossary.
6. Keep system assessment, operator shortlist decisions and each platform record's status separate. Existing platform statuses are tucked into linked-record details, not used to preselect or rank the board.

## Scope and limitations

This is a local interaction prototype using saved evaluations from 16–19 October 2026, not a production backend or a fresh full reassessment. Older ratings are marked Needs refresh. Evidence badges are interface-preview annotations; reconcile them against original source evidence before production use.

The dataset contains submission-derived information. Share within the intended development/review team and preserve access controls in the production implementation.

Original-submission links require BeyondPilot access. Workspace-relative PDF/audit links are not bundled; source references remain readable inside the detail panel. Production should resolve these to authenticated, stable source and page links.

The assessment preparation script and original submission corpus are intentionally excluded. The JSON provides the UI data shape; build the production ingestion/evaluation capability from the methodology, covering both program applications and direct use-case proposals.
