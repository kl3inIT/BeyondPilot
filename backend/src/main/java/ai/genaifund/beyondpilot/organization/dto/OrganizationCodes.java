package ai.genaifund.beyondpilot.organization.dto;

/** The codes the request records accept, as the patterns their members are checked against. */
final class OrganizationCodes {

	static final String ROLE = "provider|enterprise";

	static final String TYPE = "company|builder_team|independent_builder|other";

	static final String TEAM_SIZE = "just_me|2_9|10_49|50_99|100_499|500_999|1000_4999|5000_plus";

	static final String COUNTRY = "[A-Z]{2}";

	static final String MEMBER_ROLE = "owner|member";

	static final String WEBSITE = "https?://[^\\s]+";

	private OrganizationCodes() {
	}
}
