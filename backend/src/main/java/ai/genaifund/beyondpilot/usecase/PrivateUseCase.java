package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * What an operator writes of a use case GenAI Fund keeps private for an organization until it publishes it, for a
 * caller that is not the admin screen, such as an operator's MCP tool (BEY-232). It is checked as the admin screen's
 * form is.
 * @param industry one of the industry codes of a use case
 * @param technologies technology codes, none when the brief names none
 * @param currency {@code USD} or {@code VND}; USD when null
 */
public record PrivateUseCase(String title, String problemStatement, String industry, List<String> technologies,
		String expectedOutcomes, @Nullable String currentProcess, @Nullable String currentSolutions,
		@Nullable String targetUsers, List<Requirement> requirements, @Nullable String dataReadiness,
		@Nullable String integrationRequirements, @Nullable String currency, @Nullable Long budgetMin,
		@Nullable Long budgetMax, boolean budgetToBeDetermined, boolean budgetMembersOnly,
		@Nullable Integer timelineMinWeeks, @Nullable Integer timelineMaxWeeks, @Nullable Instant closesAt,
		boolean hideOrganizationName) {

	/** One thing the solution must do, or should. */
	public record Requirement(String statement, boolean required) {
	}

}
