"""Fill the empty fields of the imported use cases from their v1 briefs, by section, with a quote for each value.

The v1 content of most use cases is a Markdown brief with fixed headings. A section that answers a field fills
it, and the quote is the start of that section, copied from the saved brief. A field the brief does not state stays
empty: nothing here infers or guesses. Use cases whose briefs have no such section are left for a reader, who
writes the same result shape by hand.

    python -I usecase_extract.py <export.xlsx> <work folder>

reads <work folder>/staging.json (the current values on staging) and writes <work folder>/sources/<id>.brief.txt
and <work folder>/results/<id>.json.
"""

import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import openpyxl

import mapping
import records
import report

# Where a brief without a "Relevant AI Technologies" section says what it asks for, in order of preference.
ASKS = ("build brief", "build challenge", "what were looking for", "objective", "problem statement", "summary",
        "overview")
TECHNOLOGY_LABELS = {
    "conversational ai / chatbots": "conversational_ai", "conversational ai": "conversational_ai",
    "chatbots": "conversational_ai", "generative ai": "generative_ai", "generative ai / content generation":
    "generative_ai", "computer vision": "computer_vision", "document intelligence": "document_intelligence",
    "document processing": "document_intelligence", "ocr": "document_intelligence",
    "predictive analytics": "predictive_analytics", "predictive analytics / forecasting": "predictive_analytics",
    "recommendation systems / personalization": "recommendation", "recommendation systems": "recommendation",
    "voice ai": "voice_ai", "speech recognition": "voice_ai", "anomaly detection / fraud detection":
    "anomaly_detection", "anomaly detection": "anomaly_detection", "fraud detection": "anomaly_detection",
    "search & knowledge retrieval": "knowledge_retrieval", "knowledge retrieval": "knowledge_retrieval",
    "robotic process automation rpa": "process_automation", "robotic process automation": "process_automation",
    "process automation": "process_automation", "rpa": "process_automation", "agentic ai": "process_automation",
    "ai agents": "process_automation", "other": "other",
}
HEADINGS = {
    "technologies": ("relevant ai technologies",),
    "current_process": ("current solutions", "current solutions / status", "current solutions if any",
                        "current process"),
    "target_users": ("target users / teams impacted", "target users"),
    "data_readiness": ("data availability & readiness", "data availability", "available data", "inputs it leans on",
                       "provided resources"),
    "integration_requirements": ("integration deployment and infrastructure requirements",
                                 "integration deployment & infrastructure requirements",
                                 "tintegration deployment and infrastructure requirements", "deployment focus",
                                 "suggested architecture"),
    "timeline": ("preferred collaboration timeline",),
}
LIMIT = 1500


def tidy(text: str) -> str:
    lines = [re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", line).replace("**", "").rstrip() for line in text.splitlines()]
    value = "\n".join(line for line in lines if line.strip()).strip()
    if len(value) > LIMIT:
        value = value[:LIMIT].rsplit(" ", 1)[0] + "…"
    return value


def quote_of(section: str) -> str:
    """The first line of a section that says something, at most 300 characters, as it is written."""
    for line in section.splitlines():
        line = line.strip()
        if len(re.sub(r"[^\w]", "", line)) >= 3:
            return line[:300]
    return section.strip()[:300]


KEYWORDS = (
    (r"generative|genai|llm|content generation", "generative_ai"),
    (r"conversational|chatbot|virtual assistant|\bnlp\b", "conversational_ai"),
    (r"forecast|predictive|predicts?\b|time-series|scor(?:e|es|ing)\b|credit", "predictive_analytics"),
    (r"computer vision|image recognition|\bvision\b", "computer_vision"),
    (r"recommendation (?:engine|system)s?|personali[sz]|next-best|recommends? (?:places|products|items|content)",
     "recommendation"),
    (r"document|\bocr\b|data extraction", "document_intelligence"),
    (r"voice|speech", "voice_ai"),
    (r"anomaly|fraud", "anomaly_detection"),
    (r"knowledge|retrieval|\bsearch\b", "knowledge_retrieval"),
    (r"automation|\brpa\b|agentic|\bagents?\b", "process_automation"),
)


def technologies(section: str) -> list[str]:
    """The codes a "Relevant AI Technologies" section names: its labels, then the technologies an "Other: …" line
    spells out, and `other` for what names none of them (blockchain, cybersecurity)."""
    found: list[str] = []
    for part in re.split(r"[,\n;]|\s+\|\s+", section):
        label = mapping.key(re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", part).replace("**", "")).strip(" .")
        label = re.sub(r"^other:\s*", "", label)
        code = TECHNOLOGY_LABELS.get(re.sub(r"[()]", "", label)) \
            or TECHNOLOGY_LABELS.get(mapping.key(re.split(r"\s*\(", mapping.head(label))[0])) \
            or mapping.TECHNOLOGY.get(label)
        if code and code not in found:
            found.append(code)
    if not found or found == ["other"]:
        found = [code for pattern, code in KEYWORDS if re.search(pattern, section, re.I)] or ["other"]
    return found


def asked_for(found: dict[str, str], row) -> tuple[list[str], str] | None:
    """The technologies the first sentence of what the brief asks for plainly names, with that sentence."""
    texts = [found[h] for h in ASKS if h in found] + [mapping.clean(row.get("Description")) or ""]
    for text in texts:
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
            codes = [code for pattern, code in KEYWORDS if re.search(pattern, sentence, re.I)]
            if codes:
                return codes, re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", sentence).strip()[:300]
    return None


def weeks(section: str) -> tuple[int, int, str] | None:
    """A stated duration ("3 months", "8-12 weeks"), never a target date ("by Q4 2025")."""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(weeks?|months?)\b", section, re.I)
    if not match:
        return None
    low, high = float(match.group(1)), float(match.group(2) or match.group(1))
    per = 1 if match.group(3).lower().startswith("week") else 52 / 12
    lo, hi = math.floor(low * per), math.ceil(high * per)
    if lo < 1 or hi < lo or hi > 260:
        return None
    line = next(line.strip() for line in section.splitlines() if match.group(0) in line)
    return lo, hi, line[:300]


def main() -> None:
    work = Path(sys.argv[2])
    staging = {row["id"]: row for row in json.loads((work / "staging.json").read_text(encoding="utf-8"))}
    (work / "sources").mkdir(exist_ok=True)
    (work / "results").mkdir(exist_ok=True)
    workbook = openpyxl.load_workbook(sys.argv[1], read_only=True)
    filled, left = {}, {}
    for row in report.sheet(workbook, "Use Cases"):
        title = mapping.clean(row.get("Title")) or ""
        key = mapping.clean(row.get("ID"))
        if report.TEST_TITLE.match(title.strip()) or key is None:
            continue
        uid = str(records.ident("use-case", key))
        if uid not in staging:
            continue
        current = staging[uid]
        brief = f"{title}\n\n{mapping.clean(row.get('Description')) or ''}\n\n{row.get('Content') or ''}"
        source = f"sources/{uid}.brief.txt"
        (work / source).write_text(brief, encoding="utf-8")
        found = records.sections(row.get("Content"))
        section = {field: next((found[h] for h in heads if h in found), None) for field, heads in HEADINGS.items()}
        fields = {}
        if not current["technologies"] and section["technologies"]:
            codes = technologies(section["technologies"])
            if codes:
                fields["technologies"] = {"value": codes, "quote": quote_of(section["technologies"]), "source": source}
        if not current["technologies"] and "technologies" not in fields:
            asked = asked_for(found, row)
            if asked:
                fields["technologies"] = {"value": asked[0], "quote": asked[1], "source": source}
        for field in ("current_process", "target_users", "data_readiness", "integration_requirements"):
            if not current[field] and section[field]:
                fields[field] = {"value": tidy(section[field]), "quote": quote_of(section[field]), "source": source}
        if current["timeline_min_weeks"] is None and section["timeline"]:
            duration = weeks(section["timeline"])
            if duration:
                fields["timeline"] = {"value": [duration[0], duration[1]], "quote": duration[2], "source": source}
        earlier = work / "results" / f"{uid}.json"
        if earlier.is_file():
            # A value a reader wrote by hand survives a new run of the parser.
            for field, item in json.loads(earlier.read_text(encoding="utf-8"))["fields"].items():
                if item.get("by") == "reading" and field not in fields:
                    fields[field] = item
        result = {"id": uid, "title": title, "fields": fields, "by": "parser"}
        (work / "results" / f"{uid}.json").write_text(json.dumps(result, ensure_ascii=False, indent=1),
                                                      encoding="utf-8")
        for field in fields:
            filled[field] = filled.get(field, 0) + 1
        for field in ("technologies", "current_process", "target_users", "data_readiness",
                      "integration_requirements", "timeline_min_weeks"):
            name = "timeline" if field == "timeline_min_weeks" else field
            if not current[field] and name not in fields:
                left[name] = left.get(name, 0) + 1
    print("filled by the parser:", filled)
    print("still empty:", left)


if __name__ == "__main__":
    main()
