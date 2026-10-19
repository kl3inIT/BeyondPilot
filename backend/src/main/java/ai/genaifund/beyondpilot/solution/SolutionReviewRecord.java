package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One submitted solution as an operator reviews it on its admin page, for the operators' MCP server: what its owners
 * wrote, GenAI Fund's last decision and its customer deployments with theirs.
 * @param status GenAI Fund's review: {@code in_review}, {@code needs_changes}, {@code approved} or {@code rejected};
 * one taken down stays approved and has {@code suspendedAt}
 * @param decisionMessage what the operator wrote to the owners with the last decision
 * @param complete whether it has what a submission needs
 */
public record SolutionReviewRecord(UUID id, String slug, String name, UUID organizationId, String organizationName,
		@Nullable String summary, @Nullable String problemsSolved, @Nullable String valueProposition,
		@Nullable String maturity, @Nullable String traction, List<String> builtWith, List<String> industries,
		List<String> focusAreas, List<String> languages, List<String> deployment, @Nullable String channels,
		@Nullable String bestCustomerProfile, @Nullable String website, @Nullable String demoUrl,
		@Nullable String deck, @Nullable Backing backing, List<String> offers, String status,
		@Nullable String decisionReason, @Nullable String decisionMessage, @Nullable Instant suspendedAt,
		@Nullable String suspensionReason, @Nullable String suspensionMessage, boolean listed,
		@Nullable Instant featuredAt, boolean complete, @Nullable Instant submittedAt, @Nullable String submittedBy,
		Instant updatedAt, List<Deployment> customerDeployments) {

	/** What GenAI Fund says of it beside its owners' words. */
	public record Backing(@Nullable String backedBy, @Nullable String program, @Nullable String funding) {
	}

	/**
	 * A customer deployment, reviewed on its solution.
	 * @param status {@code in_review}, {@code approved} or {@code rejected}
	 */
	public record Deployment(UUID id, String title, String customer, String problem, String delivered, String stage,
			@Nullable String period, @Nullable String result, String status, @Nullable String decisionReason,
			@Nullable String decisionMessage, @Nullable Instant withdrawnAt, Instant updatedAt) {
	}

}
