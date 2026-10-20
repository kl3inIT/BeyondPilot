package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.core.io.InputStreamSource;

/**
 * A proposal a use case holds now, sent and not withdrawn, with what it says, for matching to judge it against the use
 * case's requirements (BEY-229). It is never sent to a browser as it is.
 * @param stamp when the proposal was sent, or last edited after that: what it says changes only then
 * @param approach how the sender would answer the use case, in their words
 * @param deck the PDF attached, with its bytes
 * @param solutions the solutions offered, in the proposal's order
 */
public record SentUseCaseProposal(UUID id, UUID useCaseId, UUID organizationId, Instant stamp,
		@Nullable String approach, @Nullable String teamBackground, @Nullable Deck deck, List<Solution> solutions) {

	/** The PDF of the proposal. */
	public record Deck(UUID fileId, String fileName, String mediaType, InputStreamSource content) {
	}

	/**
	 * One solution offered.
	 * @param summary what its organization wrote of it, for a solution matching cannot read in full
	 */
	public record Solution(UUID id, String name, @Nullable String summary) {
	}

}
