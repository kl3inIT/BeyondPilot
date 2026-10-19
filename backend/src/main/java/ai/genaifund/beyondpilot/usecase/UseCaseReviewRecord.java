package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One use case as an operator reads it on its admin page, for the operators' MCP server: what its organization asks
 * for and GenAI Fund's last review of it. People are named as the page names them.
 * @param status as a reader sees it now: {@code draft}, {@code in_review}, {@code needs_changes}, {@code approved} or
 * {@code closed} once its close date has passed
 * @param reviewNote what GenAI Fund asked to change, while it is sent back
 */
public record UseCaseReviewRecord(UUID id, UUID organizationId, String organizationName, @Nullable String title,
		String status, @Nullable String problemStatement, @Nullable String industry, List<String> technologies,
		@Nullable String expectedOutcomes, @Nullable String currentProcess, @Nullable String currentSolutions,
		@Nullable String targetUsers, List<Requirement> requirements, @Nullable String dataReadiness,
		@Nullable String integrationRequirements, List<String> attachments, @Nullable Long budgetMin,
		@Nullable Long budgetMax, String currency, boolean budgetToBeDetermined, boolean budgetMembersOnly,
		@Nullable Integer timelineMinWeeks, @Nullable Integer timelineMaxWeeks, boolean hideOrganizationName,
		List<String> programs, @Nullable Instant publishedAt, @Nullable Instant closesAt,
		@Nullable Instant featuredAt, Instant createdAt, String createdBy, @Nullable Instant submittedAt,
		@Nullable String submittedBy, @Nullable Instant reviewedAt, @Nullable String reviewedBy,
		@Nullable String reviewNote, Instant updatedAt) {

	/** @param necessity {@code required} or {@code optional} */
	public record Requirement(String statement, String necessity) {
	}

}
