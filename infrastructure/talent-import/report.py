"""Reads the registrations, maps every value and writes what an import would do. It writes nothing else.

    python report.py <registrations.xlsx> <output directory>

`report.md` names people and stays on the machine that ran it; `summary.md` holds counts only.
"""

import collections
import sys
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import records


def table(counter, limit=None) -> str:
    lines = ["| Value | Count |", "| --- | --- |"]
    lines += [f"| {value} | {count} |" for value, count in counter.most_common(limit)]
    return "\n".join(lines)


def summary(read: records.Read) -> str:
    profiles = read.profiles
    shared = collections.Counter(p.slug for p in profiles)
    filled = collections.Counter()
    for p in profiles:
        filled["works at"] += p.works_at is not None
        filled["country"] += p.country is not None
        filled["industry"] += bool(p.industries)
        filled["LinkedIn link"] += p.website is not None
        filled["project summary"] += p.project.summary is not None
    unknown = "\n\n".join(f"### Unknown {column}\n\n{table(values)}" for column, values in sorted(read.unknown.items()))
    return f"""# AABW talent import: summary

Built {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC. Counts only.

- Rows read: {read.rows}
- Profiles an import would write: {len(profiles)}
- Rows left out: {sum(read.left_out.values())}

## Left out, by reason

{table(read.left_out)}

## Changed on the way in

{table(read.changed)}

## What the profiles hold

{table(filled)}

- Profiles sharing an address with another, which take a number: {sum(n for n in shared.values() if n > 1)}
- Skills per profile: fewest {min(len(p.skills) for p in profiles)}, most {max(len(p.skills) for p in profiles)}

### Job titles

{table(collections.Counter(p.job_title for p in profiles), 20)}

### Roles

{table(collections.Counter(r for p in profiles for r in p.roles))}

### Countries

{table(collections.Counter(p.country or "(none)" for p in profiles), 12)}

### Industries

{table(collections.Counter(i for p in profiles for i in p.industries))}

### Skills

{table(collections.Counter(s for p in profiles for s in p.skills))}

{unknown}
"""


def full(read: records.Read) -> str:
    by_reason = collections.defaultdict(list)
    for reason, number, name in read.left_out_rows:
        by_reason[reason].append(f"- row {number}: {name}" if number else f"- {name}")
    named = ("test name", "name not usable", "no skill stated", "nothing to make a headline from",
             "same LinkedIn profile as a later registration")
    sections = [f"## {reason} ({len(by_reason[reason])})\n\n" + "\n".join(by_reason[reason])
                for reason in named if by_reason[reason]]
    sample = "\n".join(f"- {p.name} | {p.headline} | {p.bio} | {', '.join(p.skills)} | {p.project.title}"
                       for p in read.profiles[::max(1, len(read.profiles) // 40)])
    return ("# AABW talent import: report\n\nNames people. It stays on the machine that ran it.\n\n"
            + "\n\n".join(sections) + "\n\n## A sample of the profiles\n\n" + sample + "\n")


def main() -> int:
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    read = records.read(openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True))
    (out / "summary.md").write_text(summary(read), encoding="utf-8")
    (out / "report.md").write_text(full(read), encoding="utf-8")
    print(f"Wrote {out / 'summary.md'} and {out / 'report.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
