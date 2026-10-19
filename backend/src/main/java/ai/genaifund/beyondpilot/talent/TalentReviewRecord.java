package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One submitted talent profile as an operator reviews it on its admin page, for the operators' MCP server: what the
 * person wrote and GenAI Fund's last decision on it.
 * @param email the address of the account the profile belongs to
 * @param status GenAI Fund's review: {@code in_review}, {@code needs_changes} or {@code approved}; one taken down
 * stays approved and has {@code suspendedAt}
 * @param decisionMessage what the operator wrote to the person when sending it back
 */
public record TalentReviewRecord(UUID id, String slug, String name, String email, @Nullable String headline,
		@Nullable String bio, List<String> roles, List<String> skills, List<String> industries,
		List<String> languages, List<String> engagement, @Nullable String rateBand, @Nullable String worksAt,
		@Nullable String city, @Nullable String country, @Nullable String website, List<Project> projects,
		String status, @Nullable String decisionReason, @Nullable String decisionMessage,
		@Nullable Instant suspendedAt, @Nullable String suspensionReason, @Nullable String suspensionMessage,
		boolean listed, @Nullable Instant featuredAt, boolean complete, @Nullable Instant submittedAt,
		Instant updatedAt) {

	public record Project(String title, @Nullable String summary, @Nullable String url, @Nullable Integer year,
			@Nullable String stage) {
	}

}
