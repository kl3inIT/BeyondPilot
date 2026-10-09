"""The talent profiles BeyondPilot gets from the registrations of Agentic AI Build Week.

One profile for each approved builder who stated a name, a job title and a piece of work. Identifiers are UUID
version 5 of the email address, so the same file always gives the same ids and a second load adds nothing twice.
"""

import collections
import re
import unicodedata
import uuid
from dataclasses import dataclass, field

import mapping

NAMESPACE = uuid.UUID("0b6f2a8e-9c1d-4e57-8a3b-2f4d6c7e9a10")

# The limits of SaveTalentProfileRequest: a profile past one of them could not be saved by its owner.
NAME, HEADLINE, WORKS_AT, SKILLS, PROJECT_TITLE, PROJECT_SUMMARY = 120, 160, 120, 15, 120, 600

TEST_NAME = re.compile(r"(?i)^(test|testing|tester|demo|a+|x+|asd\w*)( \w+)?$")
NOT_A_NAME = re.compile(r"[\d@]")


def ident(kind: str, email: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{kind}:{email}")


def slug(name: str) -> str:
    """As TalentViews.slug makes it, without its fallback: empty when the name has no Latin letter or digit."""
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:60].rstrip("-") if len(text) > 60 else text


@dataclass
class Project:
    title: str
    summary: str | None


@dataclass
class Profile:
    email: str
    name: str
    slug: str
    headline: str
    bio: str
    roles: list[str]
    skills: list[str]
    project: Project
    registered_at: str
    job_title: str
    country: str | None = None
    industries: list[str] = field(default_factory=list)
    works_at: str | None = None
    website: str | None = None

    @property
    def account_id(self) -> uuid.UUID:
        return ident("account", self.email)

    @property
    def id(self) -> uuid.UUID:
        return ident("profile", self.email)

    @property
    def project_id(self) -> uuid.UUID:
        return ident("project", self.email)


@dataclass
class Read:
    rows: int = 0
    profiles: list[Profile] = field(default_factory=list)
    # Why a row became no profile, and the rows themselves for the report that stays on the machine.
    left_out: collections.Counter = field(default_factory=collections.Counter)
    left_out_rows: list[tuple[str, int, str]] = field(default_factory=list)
    # Values the mapping does not know, by column.
    unknown: dict[str, collections.Counter] = field(default_factory=lambda: collections.defaultdict(collections.Counter))
    # What was changed on the way in: a name recased, a text shortened, a list capped.
    changed: collections.Counter = field(default_factory=collections.Counter)


def person_name(row, read: Read) -> str | None:
    """The name as stated; from the first and last name when the name is an address or holds digits or no Latin
    letter. A name written all in capitals or all in lowercase is given its capitals."""
    name = mapping.clean(row.get("name"))
    if name is None or NOT_A_NAME.search(name) or not slug(name):
        parts = [mapping.clean(row.get("first_name")), mapping.clean(row.get("last_name"))]
        name = " ".join(p for p in parts if p) or None
        if name is None or NOT_A_NAME.search(name) or not slug(name):
            return None
        read.changed["name taken from the first and last name"] += 1
    if name.isupper() or name.islower():
        name = " ".join(word.capitalize() for word in name.split(" "))
        read.changed["name given its capitals"] += 1
    return name if len(name) <= NAME else None


def skills(row, read: Read) -> list[str]:
    """The programming languages, then the models and tools, as chosen; the first fifteen."""
    found: list[str] = []
    for answer in mapping.choices(mapping.clean(row.get("primary_programming_language"))):
        if answer.lower() in mapping.NO_SKILL:
            continue
        skill = mapping.LANGUAGE.get(answer.lower())
        if skill is None:
            read.unknown["programming language"][answer] += 1
        elif skill not in found:
            found.append(skill)
    for answer in mapping.choices(mapping.clean(row.get("which_ai_models_tools"))):
        if answer.lower() in mapping.NO_SKILL:
            continue
        skill = mapping.TOOL.get(answer)
        if skill is None:
            read.unknown["model or tool"][answer] += 1
        elif skill not in found:
            found.append(skill)
    if len(found) > SKILLS:
        read.changed["skills cut to the first fifteen"] += 1
    return found[:SKILLS]


def project(text: str, read: Read) -> Project:
    """One piece of work from the one answer: its title, and the whole answer as the summary when it is longer."""
    if len(text) <= PROJECT_TITLE:
        return Project(text, None)
    if len(text) > PROJECT_SUMMARY:
        read.changed["project summary shortened"] += 1
    return Project(mapping.cut(text, PROJECT_TITLE), mapping.cut(text, PROJECT_SUMMARY))


def bio(title: str | None, company: str | None, row) -> str:
    """What the person stated at registration, as sentences; nothing they did not state."""
    place = company.rstrip(".") if company else None
    if title and place:
        sentences = [f"{title} at {place}."]
    else:
        sentences = [f"{title}." if title else f"Works at {place}."]
    years = mapping.YEARS.get(mapping.clean(row.get("years_experience_ai_ml")) or "")
    if years:
        sentences.append(f"{years} of experience with AI and ML.")
    track = mapping.TRACK.get(mapping.clean(row.get("track_interest")) or "")
    if track:
        sentences.append(track)
    sentences.append("Registered as a builder for Agentic AI Build Week.")
    return " ".join(sentences)


def profile(row, number: int, read: Read) -> Profile | None:
    def leave_out(reason: str) -> None:
        read.left_out[reason] += 1
        read.left_out_rows.append((reason, number, mapping.clean(row.get("name")) or ""))

    status = mapping.clean(row.get("approval_status")) or "no status"
    if status != "approved":
        return leave_out(f"not approved ({status})")
    if "builder" not in (mapping.clean(row.get("ticket_name")) or "").lower():
        return leave_out("no builder ticket")
    stated_name = mapping.clean(row.get("name"))
    if stated_name is None:
        return leave_out("no name")
    if TEST_NAME.match(stated_name):
        return leave_out("test name")
    stated_title = mapping.clean(row.get("job_title"))
    if stated_title is None:
        return leave_out("no job title")
    work = mapping.clean(row.get("projects_gen_ai"))
    if mapping.says_nothing(work):
        return leave_out("no project stated")
    name = person_name(row, read)
    if name is None:
        return leave_out("name not usable")
    found = skills(row, read)
    if not found:
        return leave_out("no skill stated")
    title = None if stated_title.lower() in mapping.NO_TITLE else stated_title
    company = mapping.clean(row.get("company"))
    if mapping.says_nothing(company, mapping.NO_COMPANY):
        company = None
    elif len(company) > WORKS_AT:
        company = None
        read.changed["company longer than a profile takes, left empty"] += 1
    if title is None and company is None:
        return leave_out("nothing to make a headline from")

    headline = " · ".join(part for part in (title, company) if part)
    if len(headline) > HEADLINE:
        headline = mapping.cut(headline, HEADLINE)
        read.changed["headline shortened"] += 1

    stated_industry = mapping.clean(row.get("industry"))
    industries = []
    if stated_industry is not None:
        if stated_industry not in mapping.INDUSTRY:
            read.unknown["industry"][stated_industry] += 1
        elif mapping.INDUSTRY[stated_industry] is None:
            read.changed["industry with no code, left empty"] += 1
        else:
            industries = [mapping.INDUSTRY[stated_industry]]

    stated_country = mapping.clean(row.get("country_of_business_operation"))
    country = mapping.COUNTRY.get(stated_country or "")
    if stated_country is not None and country is None:
        read.unknown["country"][stated_country] += 1

    stated_link = mapping.clean(row.get("linkedin"))
    website = mapping.linkedin(stated_link)
    if stated_link is not None and website is None:
        read.changed["LinkedIn link not usable, left empty"] += 1

    return Profile(
        email=str(row["email"]).strip().lower(), name=name, slug=slug(name), headline=headline,
        bio=bio(title, company, row), roles=[mapping.role(stated_title)], skills=found, project=project(work, read),
        registered_at=mapping.clean(row.get("guest_created_at")) or "", job_title=stated_title, country=country,
        industries=industries, works_at=company, website=website)


def one_per_person(profiles: list[Profile], read: Read) -> list[Profile]:
    """One profile for a person who registered twice, under one address or under several: the latest registration
    is kept. Every identifier comes from the address, so two rows of one address would be one row written twice."""
    latest: dict[str, Profile] = {}
    addresses: set[str] = set()
    kept = []
    for candidate in sorted(profiles, key=lambda p: (p.registered_at, p.email), reverse=True):
        if candidate.email in addresses:
            read.left_out["same address as a later registration"] += 1
            read.left_out_rows.append(("same address as a later registration", 0, candidate.name))
            continue
        addresses.add(candidate.email)
        person = mapping.linkedin_person(candidate.website)
        if person is not None and person in latest:
            read.left_out["same LinkedIn profile as a later registration"] += 1
            read.left_out_rows.append(("same LinkedIn profile as a later registration", 0,
                                       f"{candidate.name} (kept: {latest[person].name})"))
            continue
        if person is not None:
            latest[person] = candidate
        kept.append(candidate)
    return kept


def read(workbook) -> Read:
    rows = list(workbook.worksheets[0].iter_rows(values_only=True))
    header = [str(cell) for cell in rows[0]]
    result = Read()
    profiles = []
    for number, cells in enumerate(rows[1:], 2):
        if not any(cell is not None for cell in cells):
            continue
        result.rows += 1
        made = profile(dict(zip(header, cells)), number, result)
        if made is not None:
            profiles.append(made)
    # By address, so a second build of the same file gives every profile the same place and the same address suffix.
    result.profiles = sorted(one_per_person(profiles, result), key=lambda p: p.email)
    return result
