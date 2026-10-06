package ai.genaifund.beyondpilot.talent.dto;

/** The codes the request records accept, as the patterns their members are checked against. */
final class TalentCodes {

	static final String ROLE = "ai_engineer|ml_engineer|forward_deployed_engineer|automation_specialist"
			+ "|data_scientist|data_engineer|ai_product_manager|ai_consultant|ai_designer|other";

	static final String SORT = "name|newest";

	static final String ENGAGEMENT = "full_time|part_time|contract|advisory";

	static final String RATE_BAND = "under_25|25_50|50_100|100_150|150_plus";

	static final String COUNTRY = "[A-Z]{2}";

	/** ISO 639-1. */
	static final String LANGUAGE = "[a-z]{2}";

	/** The industries organizations and solutions are filed under. */
	static final String INDUSTRY = "banking_finance|insurance|retail_ecommerce|manufacturing|logistics|healthcare"
			+ "|education|real_estate|telecom|energy|agriculture|travel_hospitality|media_entertainment"
			+ "|public_sector|professional_services|technology|automotive_mobility|consumer_goods|other";

	static final String PROJECT_STAGE = "prototype|pilot|in_production|internal_tool";

	static final String URL = "https?://[^\\s]+";

	static final String ENQUIRY_TOPIC = "project|role|other";

	static final String DECISION_REASON = "incomplete|unverifiable|inappropriate|other";

	private TalentCodes() {
	}
}
