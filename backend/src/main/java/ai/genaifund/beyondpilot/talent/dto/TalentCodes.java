package ai.genaifund.beyondpilot.talent.dto;

/** The codes the request records accept, as the patterns their members are checked against. */
final class TalentCodes {

	static final String ROLE = "ai_engineer|ml_engineer|forward_deployed_engineer|automation_specialist"
			+ "|data_scientist|data_engineer|ai_product_manager|ai_consultant|ai_designer|other";

	static final String AVAILABILITY = "available|open_to_offers|not_available";

	static final String SORT = "name|newest";

	static final String ENGAGEMENT = "full_time|part_time|contract|advisory";

	static final String RATE_BAND = "under_25|25_50|50_100|100_150|150_plus";

	static final String COUNTRY = "[A-Z]{2}";

	static final String URL = "https?://[^\\s]+";

	static final String REJECTION = "incomplete|unverifiable|inappropriate|other";

	private TalentCodes() {
	}
}
