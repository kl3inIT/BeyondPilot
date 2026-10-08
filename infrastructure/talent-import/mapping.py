"""How each value of the registration becomes a value of a talent profile.

A value is kept as the person stated it. A label with no code in BeyondPilot is left empty, never moved to the nearest
code, and a label this file does not know is reported.
"""

import re

import vocabulary

# The answers that say nothing, compared without case or punctuation.
NOTHING = {
    "", "none", "na", "no", "nil", "null", "nope", "nothing", "notyet", "noneyet", "noproject", "noprojects",
    "notapplicable", "nothingyet", "notyetstarted", "x", "0",
}

# Companies that name no place of work.
NO_COMPANY = NOTHING | {"personal", "individual", "student", "unemployed", "private"}

# The job titles of the form that say nothing about the person.
NO_TITLE = {"others", "other"}

# The registration's industries and the code each has; None where BeyondPilot has no such industry.
INDUSTRY = {
    "Software & Internet": "technology",
    "Computers & Electronics": "technology",
    "Education": "education",
    "Financial Services": "banking_finance",
    "Professional Services": "professional_services",
    "Marketing & Advertising": "marketing_advertising",
    "Healthcare": "healthcare",
    "Media & Entertainment": "media_entertainment",
    "Consumer Goods": "consumer_goods",
    "Automotive": "automotive_mobility",
    "Transportation & Logistics": "logistics",
    "Manufacturing": "manufacturing",
    "Real Estate & Construction": "real_estate",
    "Hospitality": "travel_hospitality",
    "Travel": "travel_hospitality",
    "Agriculture": "agriculture",
    "Retail": "retail_ecommerce",
    "Telecommunications": "telecom",
    "Power & Utilities": "energy",
    "Oil & Gas": "energy",
    "Government": "public_sector",
    "Gaming": None,
    "Aerospace": None,
    "Wholesale & Distribution": None,
    "Non-Profit Organization": None,
    "Life Sciences": None,
    "Others": None,
    "Other": None,
}

# The registration's country names as ISO 3166-1 alpha-2.
COUNTRY = {
    "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", "Andorra": "AD", "Angola": "AO", "Antigua & Deps": "AG",
    "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Bangladesh": "BD", "Belgium": "BE", "Brazil": "BR",
    "Cambodia": "KH", "Canada": "CA", "China": "CN", "Costa Rica": "CR", "Egypt": "EG", "Estonia": "EE",
    "Finland": "FI", "France": "FR", "Georgia": "GE", "Germany": "DE", "India": "IN", "Indonesia": "ID",
    "Japan": "JP", "Jordan": "JO", "Kenya": "KE", "Korea South": "KR", "Laos": "LA", "Lebanon": "LB",
    "Malaysia": "MY", "Mali": "ML", "Mexico": "MX", "Myanmar, {Burma}": "MM", "Nepal": "NP", "Netherlands": "NL",
    "New Zealand": "NZ", "Nigeria": "NG", "Pakistan": "PK", "Philippines": "PH", "Poland": "PL", "Portugal": "PT",
    "Russian Federation": "RU", "Saudi Arabia": "SA", "Singapore": "SG", "South Africa": "ZA", "Spain": "ES",
    "Sri Lanka": "LK", "Sweden": "SE", "Switzerland": "CH", "Syria": "SY", "Taiwan": "TW", "Thailand": "TH",
    "Turkmenistan": "TM", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US",
    "Vietnam": "VN", "Yemen": "YE", "Zimbabwe": "ZW",
}

# The models and tools the form offers, and the skill each is shown as: the name without its list of versions.
TOOL = {
    "OpenAI / ChatGPT": "OpenAI / ChatGPT",
    "Anthropic / Claude": "Anthropic / Claude",
    "Google Gemini": "Google Gemini",
    "DeepSeek (DeepSeek-V3, DeepSeek-R1)": "DeepSeek",
    "Hugging Face": "Hugging Face",
    "Alibaba Qwen (Qwen 3.5, Qwen 2.5 series)": "Alibaba Qwen",
    "LangChain / LlamaIndex": "LangChain / LlamaIndex",
    "Google Vertex AI": "Google Vertex AI",
    "AWS Bedrock": "AWS Bedrock",
    "Groq": "Groq",
    "Meta Llama": "Meta Llama",
    "Azure OpenAI": "Azure OpenAI",
    "Moonshot AI / Kimi (Kimi K2.6, Kimi K2)": "Moonshot AI / Kimi",
    "Mistral": "Mistral",
    "Zhipu AI / GLM (GLM-5, GLM-4.5)": "Zhipu AI / GLM",
    "MiniMax (MiniMax-Text-01)": "MiniMax",
    "ByteDance Doubao / Seed": "ByteDance Doubao / Seed",
    "Weights & Biases": "Weights & Biases",
    "Replicate": "Replicate",
    "Together AI": "Together AI",
    "Baidu ERNIE (ERNIE 5.0)": "Baidu ERNIE",
    "Tencent Hunyuan": "Tencent Hunyuan",
    "01.AI (Yi series)": "01.AI",
    "StepFun (Step-3)": "StepFun",
}

# The form's own answers that name no skill.
NO_SKILL = {"other (please specify in next question)", "not applicable / non-technical"}

# The programming languages kept as skills, by their lowercase spelling: the form's choices and the plain language
# names people typed. Anything else typed there (a framework, a database, a spoken language) is reported, not kept.
LANGUAGE = {
    "python": "Python", "javascript / typescript": "JavaScript / TypeScript", "java": "Java", "c / c++": "C / C++",
    "go": "Go", "golang": "Go", "rust": "Rust", "kotlin": "Kotlin", "r": "R", "swift": "Swift", "ruby": "Ruby",
    "javascript": "JavaScript", "typescript": "TypeScript", "c": "C", "c++": "C++", "c#": "C#", "scala": "Scala",
    "php": "PHP", "sql": "SQL",
}

# The form's answers for years of AI and ML work, as the bio says them.
YEARS = {
    "Less than 1 year": "Less than 1 year", "1–2 years": "1–2 years", "3–5 years": "3–5 years",
    "6–10 years": "6–10 years", "10+ years": "More than 10 years",
    "1-2 years": "1–2 years", "3-5 years": "3–5 years", "6-10 years": "6–10 years",
}

# The form's answers for the track the person is interested in, as the bio says them.
TRACK = {
    "Both": "Interested in both consumer and enterprise AI.",
    "Consumer AI (products, apps, end-user experiences)":
        "Interested in consumer AI: products, apps and end-user experiences.",
    "Enterprise AI (B2B, workflows, internal tooling)":
        "Interested in enterprise AI: B2B, workflows and internal tooling.",
}

# A role is given only when the stated title is that role; every other title is `other`, and the headline keeps it.
ROLE_BY_TITLE = {code.replace("_", " "): code for code in vocabulary.ROLE if code != "other"}

LINKEDIN = re.compile(r"(?i)^https?://([a-z]{2,3}\.)?linkedin\.com/\S+$")
LINKEDIN_PERSON = re.compile(r"(?i)linkedin\.com/in/([^/?#\s]+)")


def clean(value) -> str | None:
    """The text of a cell with its whitespace collapsed, or None when it holds nothing."""
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def says_nothing(value: str | None, nothing=NOTHING) -> bool:
    return value is None or re.sub(r"[^a-z0-9]", "", value.lower()) in nothing


def choices(value: str | None) -> list[str]:
    """The answers of a multiple choice cell: split at commas, except those inside a choice's brackets."""
    return [part.strip() for part in re.split(r",(?![^()]*\))", value or "") if part.strip()]


def cut(text: str, limit: int) -> str:
    """The text within the limit, ended at a word and marked when something was left off."""
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:.-") + "…"


def role(title: str) -> str:
    return ROLE_BY_TITLE.get(title.lower(), "other")


def linkedin(value: str | None) -> str | None:
    """The person's LinkedIn address when the cell holds one the profile's link accepts."""
    if value is None or " " in value:
        return None
    url = value if re.match(r"(?i)^https?://", value) else "https://" + value
    return url if LINKEDIN.match(url) and len(url) <= 300 else None


def linkedin_person(url: str | None) -> str | None:
    """Who a LinkedIn address is of, the same for every spelling of it; None for an address of no one person."""
    match = LINKEDIN_PERSON.search(url or "")
    return match.group(1).lower() if match else None
