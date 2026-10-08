"""Reads the old platform's export, maps every value and writes what an import would do. It writes nothing else.

    python report.py <export.xlsx> <output directory>

`report.md` names companies and stays on the machine that ran it; `summary.md` holds counts only.
"""

import collections
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import mapping

TEST_NAME = re.compile(
    r"(?i)^(test|test \d+|testing|testing startups|a|aaaa|startup import test \d+|startuptestcompany|companyname_test"
    r"|genai test corp|test company|demo)$"
)
TEST_TITLE = re.compile(r"(?i)^(test|\[test\].*)$")
TEST_WEBSITE = re.compile(r"(?i)(^|[/.])test\.com\b")


def sheet(workbook, name):
    rows = list(workbook[name].iter_rows(values_only=True))
    header_at = next(i for i, row in enumerate(rows) if sum(cell is not None for cell in row) > 5)
    header = rows[header_at]
    return [dict(zip(header, row)) for row in rows[header_at + 1:] if any(cell is not None for cell in row)]


def is_test_startup(row) -> str | None:
    """A test name leaves a startup out, and so does a test.com website on a startup that is inactive or says nothing
    about itself. An active startup with a description keeps its record; only its website is cleared (`website`)."""
    name = mapping.clean(row.get("Company Name")) or ""
    if TEST_NAME.match(name.strip()):
        return "test name"
    if TEST_WEBSITE.search(mapping.clean(row.get("Website")) or ""):
        if row.get("Is Active") is not True or mapping.clean(row.get("Brief Description")) is None:
            return "test.com website, inactive or without a description"
    return None


def website(row) -> str | None:
    """The startup's website, or nothing where v1 holds a test.com placeholder."""
    text = mapping.clean(row.get("Website"))
    return None if text is None or TEST_WEBSITE.search(text) else text


def startups(rows):
    out = {
        "read": len(rows), "test": [], "imported": 0, "active": 0, "inactive": 0,
        "by_domain": collections.defaultdict(list), "by_name": collections.defaultdict(list),
        "no_website": 0, "no_own_domain": 0, "website_cleared": 0, "fill": collections.Counter(), "unmapped": collections.defaultdict(collections.Counter),
        "files": collections.Counter(), "files_elsewhere": collections.Counter(), "text": collections.Counter(),
        "source": collections.Counter(), "company_type": collections.Counter(), "focus": collections.Counter(),
        "industry": collections.Counter(), "maturity": collections.Counter(),
    }
    for row in rows:
        name = mapping.clean(row.get("Company Name")) or "(no name)"
        reason = is_test_startup(row)
        if reason:
            out["test"].append((name, mapping.clean(row.get("Website")), reason))
            continue
        out["imported"] += 1
        out["active" if row.get("Is Active") is True else "inactive"] += 1
        out["source"][mapping.clean(row.get("Source")) or "(none)"] += 1
        out["company_type"][mapping.clean(row.get("Company Type")) or "(none)"] += 1

        website_text = website(row)
        if website_text is None and mapping.clean(row.get("Website")):
            out["website_cleared"] += 1
        domain = mapping.registrable_domain(website_text)
        if website_text is None:
            out["no_website"] += 1
        elif domain is None:
            out["no_own_domain"] += 1
        else:
            out["by_domain"][domain].append(name)
        out["by_name"][mapping.normalised_name(name)].append(name)

        focus, from_types = mapping.solution_types(row.get("Solution Types"))
        target = mapping.industries(row.get("Target Industries"))
        industry = list(dict.fromkeys(target.codes + from_types.codes))
        maturity, maturity_unmapped = mapping.maturity(row.get("Product Stage"))
        size, size_unmapped = mapping.team_size(row.get("Company Size"))
        country, country_unmapped = mapping.country(row.get("Registration Country"))
        deployment = mapping.deployment(row.get("Infrastructure Used"))
        for code in focus.codes:
            out["focus"][code] += 1
        for code in industry:
            out["industry"][code] += 1
        out["maturity"][maturity or "(none)"] += 1
        for label in focus.unmapped:
            out["unmapped"]["Solution Types"][label] += 1
        for label in target.unmapped:
            out["unmapped"]["Target Industries"][label] += 1
        for column, label in (("Product Stage", maturity_unmapped), ("Company Size", size_unmapped),
                              ("Registration Country", country_unmapped)):
            if label:
                out["unmapped"][column][label] += 1
        for label in deployment.unmapped:
            out["unmapped"]["Infrastructure Used"][label] += 1

        fields = {
            "summary": mapping.clean(row.get("Brief Description")), "focus areas": focus.codes,
            "industries": industry, "maturity": maturity, "team size": size, "country": country,
            "deployment": deployment.codes, "problems solved": mapping.clean(row.get("Problems Solved")),
            "value proposition": mapping.clean(row.get("Unique Value Proposition")),
            "best customer profile": mapping.clean(row.get("Best Customer Profile")),
            "competitors": mapping.clean(row.get("Competitors")),
            "founded year": mapping.clean(row.get("Year Founded")), "website": domain,
        }
        for field, value in fields.items():
            if value:
                out["fill"][field] += 1
        for column, kind in (("Logo", "logo"), ("Customer Solution Deck", "customer deck"),
                             ("Pitch Deck", "pitch deck")):
            url = mapping.clean(row.get(column))
            if url and mapping.fetchable(url):
                out["files"][kind + ("" if url.startswith(mapping.FETCHABLE) else ", on Google if public")] += 1
            elif url and "google.com" in url:
                out["files_elsewhere"][kind + ", a Google folder or page, not a file"] += 1
            elif url:
                out["files_elsewhere"][kind + ", broken (a browser blob: address or text)"] += 1
        # A demo is kept as a link, never fetched.
        demo = mapping.clean(row.get("Product Demo"))
        if demo and re.match(r"(?i)^https?://", demo):
            out["fill"]["demo link"] += 1
        elif demo:
            out["files_elsewhere"]["demo, broken (not an http link)"] += 1
        for column in ("Customer Solution Text", "Pitch Deck Text"):
            if mapping.clean(row.get(column)):
                out["text"][column] += 1
    out["duplicate_domains"] = {d: names for d, names in out["by_domain"].items() if len(names) > 1}
    out["duplicate_names"] = {n: names for n, names in out["by_name"].items() if n and len(names) > 1}
    return out


def use_cases(rows, now):
    out = {
        "read": len(rows), "test": [], "imported": 0, "enterprises": {}, "anonymous": 0,
        "budget": collections.Counter(), "budget_unmapped": collections.Counter(), "open": 0, "closed": 0,
        "no_deadline": 0, "programs": collections.Counter(), "with_program": 0, "technologies": collections.Counter(),
        "industry": collections.Counter(), "no_industry": 0, "unmapped_tags": collections.Counter(),
        "unmapped_industry": collections.Counter(), "attachments": 0, "attachment_files": 0, "attachment_relative": 0, "not_approved": 0,
        "not_public": 0,
    }
    for row in rows:
        title = mapping.clean(row.get("Title")) or "(no title)"
        if TEST_TITLE.match(title.strip()):
            out["test"].append(title)
            continue
        out["imported"] += 1
        enterprise = mapping.clean(row.get("Enterprise ID"))
        if enterprise:
            out["enterprises"][enterprise] = (mapping.clean(row.get("Enterprise Name")),
                                               mapping.clean(row.get("Enterprise Industry")))
        if row.get("Is Anonymous") is True:
            out["anonymous"] += 1
        if row.get("Is Approved") is not True:
            out["not_approved"] += 1
        if row.get("Is Public") is not True:
            out["not_public"] += 1
        budget = mapping.budget(row.get("Price"))
        if budget.unmapped:
            out["budget_unmapped"][budget.unmapped] += 1
        out["budget"]["to be determined" if budget.to_be_determined else budget.currency] += 1
        deadline = row.get("Submission Deadline")
        if isinstance(deadline, str):
            try:
                deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
            except ValueError:
                deadline = None
        if deadline is None:
            out["no_deadline"] += 1
        else:
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            out["open" if deadline > now else "closed"] += 1
        tags = mapping.tags(row.get("Tags"))
        if tags.programs:
            out["with_program"] += 1
        for program in tags.programs:
            out["programs"][program] += 1
        for code in tags.technologies:
            out["technologies"][code] += 1
        for tag in tags.unmapped:
            out["unmapped_tags"][tag] += 1
        industry = mapping.industries(row.get("Enterprise Industry"))
        codes = industry.codes or tags.industries
        for label in industry.unmapped:
            out["unmapped_industry"][label] += 1
        if codes:
            out["industry"][codes[0]] += 1
        else:
            out["no_industry"] += 1
        files = [u.strip() for u in str(row.get("Attachment URLs") or "").replace("|||", ",").split(",") if u.strip()]
        if files:
            out["attachments"] += 1
            out["attachment_files"] += len(files)
            # The export names them by a path on v1 with no host; the host is confirmed before they are fetched.
            out["attachment_relative"] += sum(1 for u in files if u.startswith("/"))
    return out


def table(counter, limit=None):
    lines = ["| Value | Count |", "| --- | --- |"]
    for value, count in counter.most_common(limit):
        lines.append(f"| {str(value).replace('|', '/')} | {count} |")
    return "\n".join(lines)


def summary(s, u):
    dup_domain_records = sum(len(v) for v in s["duplicate_domains"].values())
    dup_name_records = sum(len(v) for v in s["duplicate_names"].values())
    unmapped_total = {column: sum(c.values()) for column, c in s["unmapped"].items()}
    lines = [
        "# v1 import: dry run summary", "",
        f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}. Counts only; nothing was written.", "",
        "## Startups", "",
        f"- Read: {s['read']}. Test records left out: {len(s['test'])}. To import: {s['imported']}.",
        f"- Active, solution `in_review`: {s['active']}. Inactive, solution `draft`: {s['inactive']}. "
        "Every organization `in_review`, every solution unlisted.",
        f"- Possible duplicates: {len(s['duplicate_domains'])} domains shared by {dup_domain_records} startups; "
        f"{len(s['duplicate_names'])} names shared by {dup_name_records} startups. Reported, not merged.",
        f"- No website: {s['no_website']}. Website on a social or hosting domain, so no domain of its own: "
        f"{s['no_own_domain']}. A test.com placeholder cleared, the startup kept: {s['website_cleared']}.",
        "", "Fields filled after mapping:", "", table(s["fill"]),
        "", "Files that can be fetched:", "", table(s["files"]),
        "", "Files not fetched:", "", table(s["files_elsewhere"]),
        "", f"Extracted text available: {dict(s['text'])}.",
        "", "Focus areas:", "", table(s["focus"]), "", "Industries:", "", table(s["industry"]),
        "", "Maturity:", "", table(s["maturity"]),
        "", "Unmapped values (left empty, listed in the full report):", "",
        "| Column | Values | Records |", "| --- | --- | --- |",
        *[f"| {column} | {len(s['unmapped'][column])} | {unmapped_total[column]} |" for column in s["unmapped"]],
        "", "v1 Source (counted only):", "", table(s["source"]),
        "", "v1 Company Type (counted only):", "", table(s["company_type"]),
        "", "## Use cases", "",
        f"- Read: {u['read']}. Test records left out: {len(u['test'])}. To import, all `draft`: {u['imported']}.",
        f"- Enterprises, each an organization `in_review`: {len(u['enterprises'])}.",
        f"- Name hidden: {u['anonymous']}. Not approved on v1: {u['not_approved']}. Not public on v1: {u['not_public']}.",
        f"- Deadline still open: {u['open']}. Passed: {u['closed']}. None: {u['no_deadline']}.",
        f"- Linked to a program: {u['with_program']}.",
        f"- With attachments: {u['attachments']} ({u['attachment_files']} files, {u['attachment_relative']} named by a "
        "path on v1 without a host).",
        f"- Industry found: {sum(u['industry'].values())}; none: {u['no_industry']}.",
        "", "Budgets:", "", table(u["budget"]), "", "Programs:", "", table(u["programs"]),
        "", "Technologies from tags:", "", table(u["technologies"]),
        "", f"Tags with no field in BeyondPilot (topic words, not stored): {len(u['unmapped_tags'])} distinct, "
        f"{sum(u['unmapped_tags'].values())} uses.",
    ]
    if u["budget_unmapped"]:
        lines += ["", "Budgets not understood:", "", table(u["budget_unmapped"])]
    return "\n".join(lines) + "\n"


def full(s, u):
    lines = ["# v1 import: dry run report (names companies: never commit or share)", "",
             "## Startup test records left out", "", "| Name | Website | Rule |", "| --- | --- | --- |"]
    lines += [f"| {n} | {w or ''} | {r} |" for n, w, r in s["test"]]
    lines += ["", "## Startups sharing a domain", ""]
    for domain, names in sorted(s["duplicate_domains"].items()):
        lines.append(f"- `{domain}`: " + "; ".join(names))
    lines += ["", "## Startups sharing a name", ""]
    for name, names in sorted(s["duplicate_names"].items()):
        lines.append(f"- " + "; ".join(names))
    for column, counter in s["unmapped"].items():
        lines += ["", f"## Unmapped: {column}", "", table(counter)]
    lines += ["", "## Use case test records left out", ""] + [f"- {t}" for t in u["test"]]
    lines += ["", "## Enterprises", "", "| v1 id | Name | Industry |", "| --- | --- | --- |"]
    lines += [f"| {i} | {n} | {(ind or '').replace('|', '/')} |" for i, (n, ind) in sorted(u["enterprises"].items())]
    lines += ["", "## Unmapped enterprise industries", "", table(u["unmapped_industry"])]
    lines += ["", "## Tags with no field", "", table(u["unmapped_tags"])]
    return "\n".join(lines) + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    mapping.check_codes()
    workbook = openpyxl.load_workbook(sys.argv[1], read_only=True)
    now = datetime.now(timezone.utc)
    s = startups(sheet(workbook, "Startups"))
    u = use_cases(sheet(workbook, "Use Cases"), now)
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    (out / "summary.md").write_text(summary(s, u), encoding="utf-8")
    (out / "report.md").write_text(full(s, u), encoding="utf-8")
    print(f"Wrote {out / 'summary.md'} and {out / 'report.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
