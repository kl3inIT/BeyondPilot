package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

/** Which stored file is the deck of an approved solution, without its bytes. */
public record SolutionDeckFile(UUID solutionId, UUID fileId) {
}
