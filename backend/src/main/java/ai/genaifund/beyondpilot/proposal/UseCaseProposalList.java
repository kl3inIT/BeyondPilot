package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * The proposals a use case received, the latest first, for a module that reports them to an operator: the MCP
 * server's {@code list_proposals} (BEY-222). What a proposal says is read one at a time.
 */
public record UseCaseProposalList(UUID useCaseId, String useCaseTitle, @Nullable Instant closesAt, int shortlisted,
		int declined, int pending, List<Item> proposals) {

	/** One sent proposal: who sent it, with which solutions, and the use case owner's decision. */
	public record Item(UUID id, String organizationName, List<String> solutionNames, @Nullable String contactName,
			Instant sentAt, @Nullable Instant editedAt, @Nullable String decision, @Nullable Instant decidedAt,
			@Nullable String decidedBy, @Nullable Instant outcomeSentAt) {
	}

}
