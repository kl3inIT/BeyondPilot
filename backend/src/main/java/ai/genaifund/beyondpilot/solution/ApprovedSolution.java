package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

/**
 * An approved solution as another module needs it: what it is called and which organization offers it.
 */
public record ApprovedSolution(UUID id, String name, UUID organizationId) {
}
