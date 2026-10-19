package ai.genaifund.beyondpilot.organization;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One organization as an operator reviews it on its admin page, for the operators' MCP server: its profile, GenAI
 * Fund's last decision on it, its people and the open requests to own it.
 * @param status GenAI Fund's review: {@code in_review}, {@code needs_changes}, {@code approved}, {@code rejected} or
 * {@code merged}; one taken down stays approved and has {@code suspendedAt}
 * @param decisionMessage what the operator wrote to the owners when refusing it or sending it back
 */
public record OrganizationReviewRecord(UUID id, String slug, String name, String type, @Nullable String website,
		@Nullable String country, @Nullable String teamSize, List<String> industries, @Nullable String description,
		@Nullable Integer foundedYear, @Nullable String teamBackground, @Nullable String emailDomain, String status,
		@Nullable String decisionReason, @Nullable String decisionMessage, @Nullable String suspensionReason,
		@Nullable String suspensionMessage, @Nullable Instant suspendedAt, Instant createdAt, String createdBy,
		String createdByEmail, List<Member> members, List<Invitation> invitations, List<Claim> claims,
		@Nullable Merged merged) {

	public record Member(@Nullable String name, String email, String role, @Nullable String jobTitle,
			Instant joinedAt) {
	}

	public record Invitation(String email, String role, String invitedBy, Instant createdAt, Instant expiresAt) {
	}

	/** An open request to own the organization, which GenAI Fund decides while nobody owns it. */
	public record Claim(@Nullable String name, String email, @Nullable String message, Instant createdAt) {
	}

	/** Where a merged organization went, when and by whom. */
	public record Merged(UUID intoId, String intoName, Instant mergedAt, String mergedBy) {
	}

}
