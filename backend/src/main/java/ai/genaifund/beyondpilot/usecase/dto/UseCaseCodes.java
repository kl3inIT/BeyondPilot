package ai.genaifund.beyondpilot.usecase.dto;

/** The codes the request records accept, as the patterns their members are checked against. */
final class UseCaseCodes {

	/** The industries an organization works in and a solution is filed under. */
	static final String INDUSTRY = "banking_finance|insurance|retail_ecommerce|manufacturing|logistics|healthcare"
			+ "|education|real_estate|telecom|energy|agriculture|travel_hospitality|media_entertainment"
			+ "|public_sector|professional_services|technology|automotive_mobility|consumer_goods|other";

	static final String TECHNOLOGY = "generative_ai|conversational_ai|predictive_analytics|computer_vision"
			+ "|recommendation|document_intelligence|voice_ai|anomaly_detection|knowledge_retrieval"
			+ "|process_automation|other";

	static final String NECESSITY = "required|optional";

	static final String STATUS = "draft|in_review|needs_changes|approved|closed";

	static final String SORT = "newest|deadline|budget";

	private UseCaseCodes() {
	}
}
