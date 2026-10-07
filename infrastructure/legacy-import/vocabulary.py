"""The codes BeyondPilot stores, copied from the backend so the import never writes a value the API refuses.

Sources, checked by check_vocabulary.py:
- backend/src/main/java/ai/genaifund/beyondpilot/organization/dto/OrganizationCodes.java
- backend/src/main/java/ai/genaifund/beyondpilot/solution/dto/SolutionCodes.java
- backend/src/main/java/ai/genaifund/beyondpilot/usecase/dto/UseCaseCodes.java
"""

ORGANIZATION_TYPE = ("company", "builder_team", "independent_builder", "other")

TEAM_SIZE = ("just_me", "2_9", "10_49", "50_99", "100_499", "500_999", "1000_4999", "5000_plus")

INDUSTRY = (
    "banking_finance", "insurance", "retail_ecommerce", "manufacturing", "logistics", "healthcare",
    "education", "real_estate", "telecom", "energy", "agriculture", "travel_hospitality", "media_entertainment",
    "public_sector", "professional_services", "technology", "automotive_mobility", "consumer_goods", "other",
)

FOCUS_AREA = (
    "conversational_ai", "document_processing", "computer_vision", "speech_voice", "predictive_analytics",
    "recommendation", "process_automation", "ai_agents", "generative_content", "search_knowledge",
    "data_platform", "ai_security", "other",
)

MATURITY = ("idea", "prototype", "pilot", "production", "scaled")

DEPLOYMENT = ("cloud_saas", "private_cloud", "on_premise", "hybrid")

TECHNOLOGY = (
    "generative_ai", "conversational_ai", "predictive_analytics", "computer_vision", "recommendation",
    "document_intelligence", "voice_ai", "anomaly_detection", "knowledge_retrieval", "process_automation", "other",
)

CURRENCY = ("USD", "VND")

# Where each list lives in the backend, as (file, constant) pairs for check_vocabulary.py.
SOURCES = {
    "ORGANIZATION_TYPE": ("organization/dto/OrganizationCodes.java", "TYPE"),
    "TEAM_SIZE": ("organization/dto/OrganizationCodes.java", "TEAM_SIZE"),
    "INDUSTRY": ("solution/dto/SolutionCodes.java", "INDUSTRY"),
    "FOCUS_AREA": ("solution/dto/SolutionCodes.java", "FOCUS_AREA"),
    "MATURITY": ("solution/dto/SolutionCodes.java", "MATURITY"),
    "DEPLOYMENT": ("solution/dto/SolutionCodes.java", "DEPLOYMENT"),
    "TECHNOLOGY": ("usecase/dto/UseCaseCodes.java", "TECHNOLOGY"),
}
