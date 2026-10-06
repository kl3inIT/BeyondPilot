package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

/**
 * A solution was saved by its owners, approved, or rejected. It names the solution only: a listener reads what it needs
 * through {@link SolutionDirectory#indexed(UUID)}, which is the solution as it is when the listener runs.
 */
public record SolutionChanged(UUID solutionId) {
}
