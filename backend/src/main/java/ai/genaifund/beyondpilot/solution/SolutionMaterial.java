package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

/**
 * Which material of its own a solution has beside its profile, without the material itself.
 * @param deck whether a file is attached as its deck
 * @param website whether it names a website
 */
public record SolutionMaterial(UUID solutionId, boolean deck, boolean website) {
}
