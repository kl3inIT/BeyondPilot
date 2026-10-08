"""The codes a talent profile stores, copied from the backend so the import never writes a value the API refuses.

Source, checked by check_vocabulary.py:
- backend/src/main/java/ai/genaifund/beyondpilot/talent/dto/TalentCodes.java
"""

ROLE = (
    "ai_engineer", "ml_engineer", "forward_deployed_engineer", "software_engineer", "solution_architect",
    "automation_specialist", "data_scientist", "data_engineer", "researcher", "ai_product_manager",
    "ai_consultant", "ai_designer", "founder", "student", "other",
)

INDUSTRY = (
    "banking_finance", "insurance", "retail_ecommerce", "manufacturing", "logistics", "healthcare",
    "education", "real_estate", "telecom", "energy", "agriculture", "travel_hospitality", "media_entertainment",
    "public_sector", "professional_services", "technology", "automotive_mobility", "consumer_goods",
    "climate_sustainability", "marketing_advertising", "legal", "hr_workforce", "other",
)

# Where each list lives in the backend, as (file, constant) pairs for check_vocabulary.py.
SOURCES = {
    "ROLE": ("talent/dto/TalentCodes.java", "ROLE"),
    "INDUSTRY": ("talent/dto/TalentCodes.java", "INDUSTRY"),
}
