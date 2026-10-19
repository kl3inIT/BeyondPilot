package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One proposal a use case received, as GenAI Fund reads it in Admin, for a module that reports it to an operator: the
 * MCP server's {@code get_proposal} (BEY-222).
 * @param approach how the sender would answer the use case, in their words
 * @param deck the PDF attached, if any
 */
public record ReceivedProposal(UUID id, UUID useCaseId, String useCaseTitle, String organizationName,
		boolean organizationApproved, List<Solution> solutions, @Nullable String approach,
		@Nullable String teamBackground, Contact sentBy, @Nullable Sender sender, @Nullable Deck deck, Instant sentAt,
		@Nullable Instant editedAt, @Nullable String decision, @Nullable Instant decidedAt, @Nullable String decidedBy,
		@Nullable Instant outcomeSentAt) {

	public record Solution(UUID id, String name, @Nullable String summary, @Nullable String slug) {
	}

	/** Who sent it and how to reach them. */
	public record Contact(@Nullable String name, String email, @Nullable String country, @Nullable String phone) {
	}

	/** The sender's own profile, when they have one. */
	public record Sender(String name, @Nullable String headline, @Nullable String bio, List<String> roles,
			List<String> skills, @Nullable String country, @Nullable String worksAt, @Nullable String website) {
	}

	public record Deck(UUID fileId, String name, long sizeBytes) {
	}

}
