"""The rows BeyondPilot gets from the export: organizations, solutions, use cases and the files they name.

Identifiers are UUID version 5 of the v1 identifiers, so the same export always gives the same ids and a second load
of it is recognised.
"""

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import mapping
import report

NAMESPACE = uuid.UUID("5d0f6c3e-4a51-4f43-9a1c-7e2b8f0c6a74")

# The longest description an organization's profile takes; the full text stays in the solution's summary.
ORGANIZATION_DESCRIPTION = 280

# The sections of a v1 use case's content and the column each fills; the first heading found wins.
SECTIONS = {
    "problem_statement": ("problem statement", "summary", "overview"),
    "target_users": ("target users / teams impacted", "target users"),
    "expected_outcomes": ("expected outcomes / success metrics", "expected outcomes"),
    "current_solutions": ("current solutions", "current solutions / status", "current solutions if any"),
    "data_readiness": ("data availability & readiness",),
    "integration_requirements": ("integration deployment and infrastructure requirements",),
}


def ident(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{kind}:{key}")


@dataclass
class File:
    """A file on v1 the load fetches and stores for one purpose."""
    url: str
    purpose: str
    name: str | None = None

    @property
    def id(self) -> uuid.UUID:
        return ident("file:" + self.purpose, self.url)


@dataclass
class Organization:
    id: uuid.UUID
    name: str
    website: str | None = None
    country: str | None = None
    team_size: str | None = None
    company_size_label: str | None = None
    industries: list[str] = field(default_factory=list)
    description: str | None = None
    founded_year: int | None = None
    logo: File | None = None


@dataclass
class Solution:
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    status: str
    summary: str | None = None
    problems_solved: str | None = None
    value_proposition: str | None = None
    focus_areas: list[str] = field(default_factory=list)
    industries: list[str] = field(default_factory=list)
    maturity: str | None = None
    deployment: list[str] = field(default_factory=list)
    built_with: list[str] = field(default_factory=list)
    product_names: list[str] = field(default_factory=list)
    core_technology: str | None = None
    infrastructure_used: str | None = None
    segment_focus: list[str] = field(default_factory=list)
    notable_paying_customers: str | None = None
    use_case_industries: list[str] = field(default_factory=list)
    use_case_descriptions: str | None = None
    monetization_model: str | None = None
    company_funding_status: str | None = None
    company_funding_raised: str | None = None
    competitors: str | None = None
    website: str | None = None
    best_customer_profile: str | None = None
    traction: str | None = None
    demo_url: str | None = None
    decks: list[File] = field(default_factory=list)

@dataclass
class UseCase:
    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    currency: str
    budget_min: int | None
    budget_max: int | None
    budget_to_be_determined: bool
    hide_organization_name: bool
    closes_at: datetime | None
    industry: str | None
    technologies: list[str]
    programs: list[str]
    sections: dict[str, str | None]
    attachments: list[File] = field(default_factory=list)


@dataclass
class Records:
    organizations: list[Organization] = field(default_factory=list)
    solutions: list[Solution] = field(default_factory=list)
    use_cases: list[UseCase] = field(default_factory=list)
    left_out: list[str] = field(default_factory=list)


def shorten(text: str | None, limit: int) -> str | None:
    """The text whole when it fits, else cut at the last word that fits, with an ellipsis."""
    if text is None or len(text) <= limit:
        return text
    cut = text[:limit - 1].rsplit(" ", 1)[0].rstrip(" ,.;:")
    return cut + "…"


def year(value) -> int | None:
    match = re.search(r"\b(1[89]\d\d|20\d\d)\b", str(value or ""))
    return int(match.group(1)) if match else None


def list_values(value) -> list[str]:
    """Split a v1 text list without storing a pointer such as 'See above' as a product or technology."""
    text = mapping.clean(value)
    if text is None or text.casefold() in {"see above", "as above", "same as above"}:
        return []
    parts = re.split(r"\s*(?:\|\|\||,|\r?\n)\s*", text)
    return list(dict.fromkeys(part.strip() for part in parts if part.strip()))


def https(value) -> str | None:
    text = mapping.clean(value)
    return text if text and re.match(r"(?i)^https://\S+$", text) else None


def sections(content) -> dict[str, str]:
    """A use case's markdown content as heading → text, headings lowercased without punctuation."""
    found: dict[str, str] = {}
    heading, lines = None, []
    for line in str(content or "").splitlines():
        match = re.match(r"^#+\s*(.+?)\s*$", line)
        if match:
            if heading and "\n".join(lines).strip():
                found.setdefault(heading, "\n".join(lines).strip())
            heading = re.sub(r"[^\w &/]", "", match.group(1)).strip().lower()
            lines = []
        else:
            lines.append(line)
    if heading and "\n".join(lines).strip():
        found.setdefault(heading, "\n".join(lines).strip())
    return found


def deadline(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        moment = value
    else:
        try:
            moment = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    # The export writes UTC; 16:59:59 is 23:59:59 in Vietnam.
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def startup(row, out: Records) -> None:
    code = mapping.clean(row.get("Startup Code"))
    name = mapping.clean(row.get("Company Name"))
    if code is None or name is None:
        out.left_out.append("a startup without a code or a name")
        return
    focus, from_types = mapping.solution_types(row.get("Solution Types"))
    industries = list(dict.fromkeys(mapping.industries(row.get("Target Industries")).codes + from_types.codes))
    summary = mapping.clean(row.get("Brief Description"))
    website = report.website(row)
    logo_url = mapping.clean(row.get("Logo"))
    organization = Organization(
        id=ident("startup-organization", code), name=name, website=website,
        country=mapping.country(row.get("Registration Country"))[0],
        team_size=mapping.team_size(row.get("Company Size"))[0],
        company_size_label=mapping.clean(row.get("Company Size")), industries=industries,
        description=shorten(summary, ORGANIZATION_DESCRIPTION), founded_year=year(row.get("Year Founded")),
        logo=File(mapping.source_url(logo_url), "organization_logo") if mapping.fetchable(logo_url) else None)
    # The customer deck first, the pitch deck when the customer deck cannot be had.
    decks = [File(mapping.source_url(url), "solution_deck")
             for url in (mapping.clean(row.get("Customer Solution Deck")), mapping.clean(row.get("Pitch Deck")))
             if mapping.fetchable(url)]
    solution = Solution(
        id=ident("startup-solution", code), organization_id=organization.id, name=name,
        status="in_review" if row.get("Is Active") is True else "draft", summary=summary,
        problems_solved=mapping.clean(row.get("Problems Solved")),
        value_proposition=mapping.clean(row.get("Unique Value Proposition")), focus_areas=focus.codes,
        industries=industries, maturity=mapping.maturity(row.get("Product Stage"))[0],
        deployment=mapping.deployment(row.get("Infrastructure Used")).codes,
        built_with=list_values(row.get("Models / Tech Stack Used")),
        product_names=list_values(row.get("Product Names")),
        core_technology=mapping.clean(row.get("Core Technology")),
        infrastructure_used=mapping.clean(row.get("Infrastructure Used")),
        segment_focus=list_values(row.get("Segment Focus")),
        notable_paying_customers=mapping.clean(row.get("Notable Paying Customers")),
        use_case_industries=list_values(row.get("Use Case Industries")),
        use_case_descriptions=mapping.clean(row.get("Use Case Descriptions")),
        monetization_model=mapping.clean(row.get("Monetization Model")),
        company_funding_status=mapping.clean(row.get("Funding Status")),
        company_funding_raised=mapping.clean(row.get("Funding Raised")),
        competitors=mapping.clean(row.get("Competitors")), website=website,
        best_customer_profile=mapping.clean(row.get("Best Customer Profile")),
        traction=mapping.clean(row.get("Key Milestones")), demo_url=https(row.get("Product Demo")), decks=decks)
    out.organizations.append(organization)
    out.solutions.append(solution)


def use_case(row, enterprises: dict[str, Organization], out: Records) -> None:
    key = mapping.clean(row.get("ID"))
    title = mapping.clean(row.get("Title"))
    enterprise = mapping.clean(row.get("Enterprise ID"))
    if key is None or title is None or enterprise is None:
        out.left_out.append("a use case without an id, a title or an enterprise")
        return
    if enterprise not in enterprises:
        industry = mapping.industries(row.get("Enterprise Industry")).codes
        organization = Organization(id=ident("enterprise-organization", enterprise),
                                    name=mapping.clean(row.get("Enterprise Name")) or "Enterprise", industries=industry)
        enterprises[enterprise] = organization
        out.organizations.append(organization)
    tags = mapping.tags(row.get("Tags"))
    budget = mapping.budget(row.get("Price"))
    found = sections(row.get("Content"))
    text = {column: next((found[h] for h in headings if h in found), None) for column, headings in SECTIONS.items()}
    description = mapping.clean(row.get("Description"))
    text["problem_statement"] = text["problem_statement"] or description
    if text["expected_outcomes"] is None and description != text["problem_statement"]:
        text["expected_outcomes"] = description
    industry = (mapping.industries(row.get("Enterprise Industry")).codes or tags.industries or [None])[0]
    names = [n.strip() for n in str(row.get("Attachment Names") or "").split(",")]
    paths = [p.strip() for p in str(row.get("Attachment URLs") or "").replace("|||", ",").split(",") if p.strip()]
    attachments = [File(mapping.attachment_url(path), "use_case_attachment", names[i] if i < len(names) else None)
                   for i, path in enumerate(paths) if mapping.attachment_url(path)]
    out.use_cases.append(UseCase(
        id=ident("use-case", key), organization_id=enterprises[enterprise].id, title=title,
        currency=budget.currency, budget_min=budget.minimum, budget_max=budget.maximum,
        budget_to_be_determined=budget.to_be_determined, hide_organization_name=row.get("Is Anonymous") is True,
        closes_at=deadline(row.get("Submission Deadline")), industry=industry, technologies=tags.technologies,
        programs=tags.programs, sections=text, attachments=attachments))


def read(workbook) -> Records:
    out = Records()
    for row in report.sheet(workbook, "Startups"):
        if report.is_test_startup(row):
            continue
        startup(row, out)
    enterprises: dict[str, Organization] = {}
    for row in report.sheet(workbook, "Use Cases"):
        title = mapping.clean(row.get("Title")) or ""
        if report.TEST_TITLE.match(title.strip()):
            continue
        use_case(row, enterprises, out)
    return out
