package ai.genaifund.beyondpilot.organization.dto;

/** The codes the request records accept, as the patterns their members are checked against. */
final class OrganizationCodes {

	static final String ROLE = "provider|enterprise";

	static final String TYPE = "company|builder_team|independent_builder|other";

	static final String TEAM_SIZE = "just_me|2_9|10_49|50_99|100_499|500_999|1000_4999|5000_plus";

	static final String COUNTRY = "[A-Z]{2}";

	/** The industries a solution is filed under; an organization names its own from the same list. */
	static final String INDUSTRY = "banking_finance|insurance|retail_ecommerce|manufacturing|logistics|healthcare"
			+ "|education|real_estate|telecom|energy|agriculture|travel_hospitality|media_entertainment"
			+ "|public_sector|professional_services|technology|automotive_mobility|consumer_goods|other";

	static final String MEMBER_ROLE = "owner|member";

	static final String WEBSITE = "https?://[^\\s]+";

	/** A domain name in lowercase, as the part of a work address after the at sign. */
	static final String DOMAIN = "[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+";

	private OrganizationCodes() {
	}
}
