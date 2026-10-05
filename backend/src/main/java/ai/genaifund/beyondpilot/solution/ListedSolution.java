package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

/**
 * A solution of the public directory as another module needs it: what it is called and which organization offers it.
 */
public record ListedSolution(UUID id, String name, UUID organizationId) {
}
