package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A program's applications not submitted yet, the most recently saved first, for a module that reports them to an
 * operator: the MCP server's {@code list_applications}. What a draft says is read one draft at a time.
 * @param requiredQuestions how many required questions the program asks
 */
public record ProgramDrafts(int requiredQuestions, List<Draft> drafts) {

	/**
	 * Who started a draft, how to reach them and how far they got.
	 * @param contactComplete first and last name, phone and country are filled
	 * @param requiredAnswered how many of the required questions are answered
	 */
	public record Draft(UUID id, @Nullable String firstName, @Nullable String lastName, String email,
			@Nullable String phone, @Nullable String country, @Nullable String organizationName,
			@Nullable String organizationType, boolean contactComplete, boolean solutionChosen, boolean deckAttached,
			int requiredAnswered, Instant startedAt, Instant lastSavedAt) {
	}

}
