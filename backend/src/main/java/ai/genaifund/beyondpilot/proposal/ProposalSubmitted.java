package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.UUID;

/**
 * An application was submitted, for the first time or again.
 * @param version the number of the version the submission made
 * @param recipient the applicant's address, for the confirmation
 * @param editableUntil the close of the program's applications, when the application can still change until then;
 * null when it cannot
 */
public record ProposalSubmitted(UUID proposalId, UUID programId, UUID organizationId, int version, String recipient,
		String programName, @org.jspecify.annotations.Nullable Instant editableUntil) {
}
