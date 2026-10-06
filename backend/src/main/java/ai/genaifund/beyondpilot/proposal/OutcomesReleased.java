package ai.genaifund.beyondpilot.proposal;

import java.util.List;
import java.util.UUID;

/**
 * GenAI Fund released the outcomes of a program: each applicant is told theirs.
 * @param outcomes one per submitted application, with the email as it is sent
 */
public record OutcomesReleased(UUID programId, List<Outcome> outcomes) {

	/**
	 * @param decision {@code shortlisted} or {@code not_selected}
	 */
	public record Outcome(UUID proposalId, String decision, String recipient, String subject, String message) {
	}
}
