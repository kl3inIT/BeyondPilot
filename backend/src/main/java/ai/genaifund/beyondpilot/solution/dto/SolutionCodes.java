package ai.genaifund.beyondpilot.solution.dto;

/** The codes the request records accept, as the patterns their members are checked against. */
final class SolutionCodes {

	static final String FOCUS_AREA = "conversational_ai|document_processing|computer_vision|speech_voice"
			+ "|predictive_analytics|recommendation|process_automation|ai_agents|generative_content"
			+ "|search_knowledge|data_platform|ai_security|other";

	static final String INDUSTRY = "banking_finance|insurance|retail_ecommerce|manufacturing|logistics|healthcare"
			+ "|education|real_estate|telecom|energy|agriculture|travel_hospitality|media_entertainment"
			+ "|public_sector|professional_services|technology|automotive_mobility|consumer_goods|other";

	static final String MATURITY = "idea|prototype|pilot|production|scaled";

	static final String SORT = "name|newest";

	static final String DEPLOYMENT = "cloud_saas|private_cloud|on_premise|hybrid";

	static final String LANGUAGE = "en|vi|id|ms|th|fil|zh|ja|ko|other";

	static final String WEBSITE = "https?://[^\\s]+";

	static final String REJECTION = "incomplete|not_an_ai_solution|duplicate|unverifiable|other";

	static final String STAGE = "pilot|production";

	static final String DEPLOYMENT_REJECTION = "incomplete|unverifiable|other";

	private SolutionCodes() {
	}
}
