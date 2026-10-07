"""How a value of the old platform becomes a BeyondPilot code. A value with no code is returned as unmapped, so the
report lists it; it is never stored as free text."""

import re
from dataclasses import dataclass, field

import vocabulary

# The export writes an en dash that some readers turn into U+FFFD.
DASHES = "–—�"
EMPTY = {"", "not specified", "n/a", "na", "none", "-", "null"}


def clean(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return None if text.lower() in EMPTY else text


def key(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("�", "–")).strip().lower()


def head(label: str) -> str:
    """The group a v1 label names, before its descriptive tail ("Vision AI – image or video recognition")."""
    return re.split(rf"\s*[{DASHES}]\s*|\s+-\s+", label, maxsplit=1)[0].strip()


@dataclass
class Mapped:
    codes: list[str] = field(default_factory=list)
    unmapped: list[str] = field(default_factory=list)

    def add(self, code: str) -> None:
        if code not in self.codes:
            self.codes.append(code)


INDUSTRY = {
    # Banking, finance and investment.
    "financial services": "banking_finance", "finance": "banking_finance", "banking": "banking_finance",
    "investment": "banking_finance", "fintech": "banking_finance", "finserv": "banking_finance",
    "financial services i": "banking_finance", "financial services ii": "banking_finance",
    "lending": "banking_finance", "wealthtech": "banking_finance", "venture capital & ai": "banking_finance",
    "insurance": "insurance",
    "technology / software / it services": "technology", "software & internet": "technology",
    "technology": "technology", "technology & ai solutions": "technology", "ai": "technology",
    "technology / developer tools": "technology", "software development & it services": "technology",
    "creative/design software": "technology", "cybersecurity": "technology",
    "information and communication technology": "technology", "cloud tech": "technology",
    "retail & e-commerce": "retail_ecommerce", "retail & ecommerce": "retail_ecommerce", "retail": "retail_ecommerce",
    "automotive & mobility": "automotive_mobility", "automotive": "automotive_mobility",
    "mobility": "automotive_mobility", "aviation & aerospace": "automotive_mobility",
    "aviation": "automotive_mobility",
    # Food, drink and fast-moving goods are consumer goods; so are luxury and fashion.
    "fast-moving consumer goods (fmcg)": "consumer_goods", "fmcg": "consumer_goods",
    "food & beverages": "consumer_goods", "food & beverage": "consumer_goods", "fnb": "consumer_goods",
    "f&b": "consumer_goods", "dairy": "consumer_goods", "foodtech": "consumer_goods",
    "luxury & fashion": "consumer_goods",
    "education & training": "education", "education": "education", "education technology": "education",
    "manufacturing": "manufacturing", "mining & heavy industry": "manufacturing", "mining": "manufacturing",
    "industrial ai": "manufacturing",
    "healthcare & wellness": "healthcare", "healthcare": "healthcare", "life sciences": "healthcare",
    "medicaltechnology": "healthcare",
    "logistics & supply chain": "logistics", "logistics": "logistics", "transportation & logistics": "logistics",
    "import-export": "logistics",
    "government & public sector": "public_sector", "non-profit & social impact": "public_sector",
    "real estate & construction": "real_estate", "real estate": "real_estate", "construction": "real_estate",
    "built environment": "real_estate", "property development/smart cities": "real_estate",
    "telecommunications": "telecom",
    "media, entertainment & gaming": "media_entertainment", "media & entertainment": "media_entertainment",
    "entertainment": "media_entertainment", "gaming": "media_entertainment",
    "media & broadcasting": "media_entertainment", "media & publishing": "media_entertainment",
    "content creation": "media_entertainment", "marketing & advertising": "media_entertainment",
    "marketing": "media_entertainment", "adtech": "media_entertainment",
    "marketing & content creation": "media_entertainment", "media": "media_entertainment",
    "hospitality & travel": "travel_hospitality", "travel": "travel_hospitality",
    "hospitality": "travel_hospitality", "travel & tourism": "travel_hospitality",
    "legal & professional services": "professional_services", "professional services": "professional_services",
    "legal": "professional_services", "consulting": "professional_services",
    "legal and professional service": "professional_services", "legal & compliance": "professional_services",
    "human resources": "professional_services", "hr tech": "professional_services",
    "hr-tech": "professional_services", "human resources/tourism": "professional_services",
    "energy": "energy", "oil and gas": "energy", "climate tech": "energy", "environmental solutions": "energy",
    "agritech": "agriculture", "agriculture": "agriculture",
    "other": "other", "others": "other",
}

# Retail & Hospitality names two industries.
INDUSTRY_PAIRS = {"retail & hospitality": ("retail_ecommerce", "travel_hospitality")}


def industries(value) -> Mapped:
    """Industries from a v1 list: groups split on `|||`, then on commas unless the whole group is a known label."""
    mapped = Mapped()
    text = clean(value)
    if text is None:
        return mapped
    for group in text.split("|||"):
        group = group.strip()
        if not group:
            continue
        if key(group) in INDUSTRY_PAIRS:
            for code in INDUSTRY_PAIRS[key(group)]:
                mapped.add(code)
            continue
        if key(group) in INDUSTRY:
            mapped.add(INDUSTRY[key(group)])
            continue
        if key(group).startswith("other:"):
            mapped.add("other")
            mapped.unmapped.append(group)
            continue
        for part in group.split(","):
            part = part.strip()
            if not part:
                continue
            code = INDUSTRY.get(key(part))
            if code is None and key(part) in INDUSTRY_PAIRS:
                for pair in INDUSTRY_PAIRS[key(part)]:
                    mapped.add(pair)
            elif code is None:
                mapped.unmapped.append(part)
            else:
                mapped.add(code)
    return mapped


FOCUS_AREA = {
    "agentic ai / autonomous agents": "ai_agents", "agentic ai": "ai_agents",
    "ai for workflow & productivity": "process_automation", "productivity & business solutions": "process_automation",
    "conversational ai / chatbots": "conversational_ai",
    "ai for knowledge & search": "search_knowledge",
    "predictive analytics & forecasting": "predictive_analytics", "simulation & digital twins": "predictive_analytics",
    "decision intelligence": "predictive_analytics",
    "core genai technology": "generative_content", "generative content creation": "generative_content",
    "marketing & content creation": "generative_content", "genai video systems as saas": "generative_content",
    "vision ai": "computer_vision",
    "recommendation & personalization": "recommendation",
    "speech ai": "speech_voice",
    "ai for cybersecurity & compliance": "ai_security", "security & compliance": "ai_security",
    "security and compliance": "ai_security", "regtech, compliance": "ai_security",
    # A software house or a general AI provider has no focus of its own among the codes.
    "ai for software development": "other", "software development & it services": "other",
    "technology & ai solutions": "other", "others": "other", "other": "other",
}

# Solution types that name an industry instead of a focus area; they add to the solution's industries.
SOLUTION_TYPE_INDUSTRY = {
    "financial services", "healthcare & wellness", "media & entertainment", "retail & ecommerce",
    "education technology", "education", "human resources", "legal & compliance", "real estate & construction",
    "climate tech", "environmental solutions", "logistics & supply chain", "agritech", "software & internet",
    "transportation & logistics", "marketing & advertising", "healthcare", "finance",
}


def solution_types(value) -> tuple[Mapped, Mapped]:
    """Focus areas and the industries that v1 filed among solution types."""
    focus, industry = Mapped(), Mapped()
    text = clean(value)
    if text is None:
        return focus, industry
    for label in text.split("|||"):
        label = label.strip()
        if not label:
            continue
        group = key(head(label))
        if group in FOCUS_AREA:
            focus.add(FOCUS_AREA[group])
        elif group in SOLUTION_TYPE_INDUSTRY:
            for code in industries(head(label)).codes:
                industry.add(code)
        elif group.startswith("other:"):
            focus.add("other")
            focus.unmapped.append(label)
        else:
            focus.unmapped.append(label)
    return focus, industry


MATURITY = {
    "idea / concept": "idea",
    "prototype / mvp": "prototype", "mvp": "prototype", "beta release": "prototype", "beta": "prototype",
    "pilot deployment": "pilot", "live poc (proof of concept)": "pilot",
    "production / live": "production", "production": "production",
    "scaled / growth": "scaled", "scale / growth": "scaled",
}


def maturity(value) -> tuple[str | None, str | None]:
    """The maturity code, or the unmapped label. A retired product and a segment written as a stage have none."""
    text = clean(value)
    if text is None:
        return None, None
    code = MATURITY.get(key(text))
    return (code, None) if code else (None, text)


TEAM_SIZE = {
    "100-499 employees": "100_499", "100–499 employees": "100_499",
    "500-999 employees": "500_999", "500–999 employees": "500_999",
}

# v1 bands that straddle two of BeyondPilot's: guessing one would store a size nobody gave, so they stay unknown.
TEAM_SIZE_STRADDLING = {"1-19 employees", "1–19 employees", "20-99 employees", "20–99 employees"}


def team_size(value) -> tuple[str | None, str | None]:
    """The team size band, or the unmapped label. A bare number is placed in its band."""
    text = clean(value)
    if text is None:
        return None, None
    code = TEAM_SIZE.get(key(text))
    if code:
        return code, None
    if key(text) in TEAM_SIZE_STRADDLING:
        return None, text
    if text.isdigit():
        n = int(text)
        for limit, band in ((1, "just_me"), (9, "2_9"), (49, "10_49"), (99, "50_99"), (499, "100_499"),
                            (999, "500_999"), (4999, "1000_4999")):
            if n <= limit:
                return band, None
        return "5000_plus", None
    return None, text


COUNTRY = {
    "singapore": "SG", "vietnam": "VN", "malaysia": "MY", "indonesia": "ID", "india": "IN", "united states": "US",
    "united states of america": "US", "japan": "JP", "thailand": "TH", "philippines": "PH", "australia": "AU",
    "china": "CN", "united kingdom": "GB", "taiwan": "TW", "france": "FR", "pakistan": "PK",
    "united arab emirates": "AE", "south korea": "KR", "bangladesh": "BD", "nigeria": "NG", "afghanistan": "AF",
    "germany": "DE", "hong kong": "HK", "albania": "AL", "romania": "RO", "algeria": "DZ", "canada": "CA",
    "andorra": "AD", "kenya": "KE", "morocco": "MA", "finland": "FI", "netherlands": "NL", "spain": "ES",
    "new zealand": "NZ", "myanmar": "MM", "estonia": "EE", "malawi": "MW", "bahamas": "BS", "ethiopia": "ET",
    "ireland": "IE", "south africa": "ZA", "north korea": "KP", "rwanda": "RW", "sweden": "SE",
    "kyrgyzstan": "KG", "antigua and barbuda": "AG", "israel": "IL", "qatar": "QA", "laos": "LA", "uganda": "UG",
    "italy": "IT", "mexico": "MX", "poland": "PL", "kazakhstan": "KZ", "saint vincent and the grenadines": "VC",
    "jordan": "JO", "ukraine": "UA", "bulgaria": "BG", "cambodia": "KH", "angola": "AO", "argentina": "AR",
    "malta": "MT", "sri lanka": "LK", "georgia": "GE",
}


def country(value) -> tuple[str | None, str | None]:
    text = clean(value)
    if text is None:
        return None, None
    code = COUNTRY.get(key(text))
    return (code, None) if code else (None, text)


CLOUD = ("aws", "google cloud", "azure", "alibaba", "alicloud", "digital ocean", "digitalocean", "gcp", "oracle cloud",
         "vercel", "ovh", "runpod", "modal", "replicate", "heroku", "cloudflare", "huawei cloud", "tencent cloud")


def deployment(value) -> Mapped:
    """Cloud providers mean cloud SaaS, on-premise means on-premise; both together mean hybrid."""
    mapped = Mapped()
    text = clean(value)
    if text is None:
        return mapped
    lower = text.lower()
    cloud = any(name in lower for name in CLOUD)
    on_premise = "on-premise" in lower or "on premise" in lower or "on-prem" in lower
    if cloud and on_premise:
        mapped.add("hybrid")
    elif cloud:
        mapped.add("cloud_saas")
    elif on_premise:
        mapped.add("on_premise")
    else:
        mapped.unmapped.append(text)
    return mapped


PROGRAM = {
    "aabw2026": "Agentic AI Build Week 2026",
    "shinhan innoboost 2026": "Shinhan Global Innoboost 2026", "innoboost2026": "Shinhan Global Innoboost 2026",
    "tasco innovation day": "Tasco Innovation Day 2026",
    "goi malaysia 2025": "GenAI Open Innovation Malaysia 2025",
    "goi indonesia 2025": "GenAI Open Innovation Indonesia 2025",
    "goi japan 2025": "NextGen AI Open Innovation Japan 2025",
    "nestlé vietnam ai reinvention": "Nestlé Vietnam AI Reinvention",
    "nestl� vietnam ai reinvention": "Nestlé Vietnam AI Reinvention",
}

# The program that only v1 names; the import creates it as a draft.
NEW_PROGRAMS = {"Nestlé Vietnam AI Reinvention"}

TECHNOLOGY = {
    "generative ai": "generative_ai", "genai": "generative_ai", "content generation": "generative_ai",
    "chatbot": "conversational_ai", "conversational ai": "conversational_ai", "virtual assistant": "conversational_ai",
    "nlp": "conversational_ai",
    "predictive analytics": "predictive_analytics", "forecasting": "predictive_analytics",
    "data analytics": "predictive_analytics", "analytics": "predictive_analytics", "bi": "predictive_analytics",
    "computer vision": "computer_vision", "computervision": "computer_vision", "image recognition": "computer_vision",
    "recommendation systems": "recommendation", "personalization": "recommendation",
    "document intelligence": "document_intelligence", "data extraction": "document_intelligence",
    "ocr": "document_intelligence",
    "voice ai": "voice_ai", "speech recognition": "voice_ai",
    "anomaly detection": "anomaly_detection", "fraud detection": "anomaly_detection",
    "knowledge management": "knowledge_retrieval", "search": "knowledge_retrieval",
    "automation": "process_automation", "rpa": "process_automation",
}


@dataclass
class Tags:
    programs: list[str] = field(default_factory=list)
    technologies: list[str] = field(default_factory=list)
    industries: list[str] = field(default_factory=list)
    unmapped: list[str] = field(default_factory=list)


def tags(value) -> Tags:
    """A use case's comma-separated tags: its programs, technologies and industries; the rest are topic words that
    BeyondPilot has no field for."""
    result = Tags()
    text = clean(value)
    if text is None:
        return result
    for tag in text.split(","):
        tag = tag.strip()
        if not tag:
            continue
        k = key(tag)
        if k in PROGRAM:
            if PROGRAM[k] not in result.programs:
                result.programs.append(PROGRAM[k])
        elif k in TECHNOLOGY:
            if TECHNOLOGY[k] not in result.technologies:
                result.technologies.append(TECHNOLOGY[k])
        elif k in INDUSTRY or k in INDUSTRY_PAIRS:
            for code in industries(tag).codes:
                if code not in result.industries:
                    result.industries.append(code)
        else:
            result.unmapped.append(tag)
    return result


@dataclass
class Budget:
    currency: str = "USD"
    minimum: int | None = None
    maximum: int | None = None
    to_be_determined: bool = True
    unmapped: str | None = None


def budget(value) -> Budget:
    """`TBD`, `0` and nothing are to be determined; `VND 200M` is 200,000,000 đồng; a bare number is US dollars."""
    text = clean(value)
    if text is None or key(text) in {"tbd", "0"}:
        return Budget()
    match = re.fullmatch(r"(?i)(usd|vnd)?\s*([\d.,]+)\s*([kmb])?", text.replace("$", "usd "))
    if match is None:
        return Budget(unmapped=text)
    currency = (match.group(1) or "USD").upper()
    amount = float(match.group(2).replace(",", ""))
    amount *= {"k": 1e3, "m": 1e6, "b": 1e9}.get((match.group(3) or "").lower(), 1)
    whole = int(round(amount))
    if whole == 0:
        return Budget()
    return Budget(currency=currency, minimum=whole, maximum=whole, to_be_determined=False)


SOCIAL = ("linkedin.com", "x.com", "twitter.com", "facebook.com", "instagram.com", "github.com", "github.io",
          "medium.com", "notion.site", "wixsite.com", "vercel.app", "netlify.app", "google.com", "youtube.com",
          "test.com", "bit.ly", "linktr.ee", "tiktok.com", "t.me", "wordpress.com", "webflow.io", "framer.website",
          "framer.ai", "carrd.co", "substack.com", "apple.com", "play.google.com")

SECOND_LEVEL = ("com", "co", "net", "org", "gov", "edu", "ac")


def registrable_domain(website) -> str | None:
    """The domain a company owns, without `www.`; a site on a social or hosting domain has none of its own."""
    text = clean(website)
    if text is None:
        return None
    host = re.sub(r"^[a-z]+://", "", text.strip().lower()).split("/")[0].split("?")[0].split(":")[0]
    host = host.removeprefix("www.")
    if "." not in host or " " in host:
        return None
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in SECOND_LEVEL and len(parts[-1]) == 2:
        domain = ".".join(parts[-3:])
    else:
        domain = ".".join(parts[-2:])
    if any(domain == s or host.endswith("." + s) or host == s for s in SOCIAL):
        return None
    return domain


def normalised_name(name) -> str:
    text = (clean(name) or "").lower()
    text = re.sub(r"\b(pte|ltd|limited|inc|llc|jsc|co|corp|corporation|company|sdn|bhd|pt|tbk|joint stock)\b\.?", "", text)
    return re.sub(r"[^a-z0-9]+", "", text)


FETCHABLE = "https://papi.genaifund.ai/attachments/"


def fetchable(url) -> bool:
    text = clean(url)
    return text is not None and text.startswith(FETCHABLE)


def check_codes() -> None:
    """Every code a table maps to is one BeyondPilot accepts."""
    for table, allowed in ((INDUSTRY, vocabulary.INDUSTRY), (FOCUS_AREA, vocabulary.FOCUS_AREA),
                           (MATURITY, vocabulary.MATURITY), (TEAM_SIZE, vocabulary.TEAM_SIZE),
                           (TECHNOLOGY, vocabulary.TECHNOLOGY)):
        wrong = {code for code in table.values() if code not in allowed}
        if wrong:
            raise SystemExit(f"Codes BeyondPilot does not know: {sorted(wrong)}")
    for pair in INDUSTRY_PAIRS.values():
        assert all(code in vocabulary.INDUSTRY for code in pair)
