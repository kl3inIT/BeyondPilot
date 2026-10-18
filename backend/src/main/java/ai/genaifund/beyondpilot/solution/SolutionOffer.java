package ai.genaifund.beyondpilot.solution;

/**
 * An offer a solution comes with, as another module reads it: the line that names it, the https address where it
 * is claimed, and whether GenAI Fund arranged it rather than the organization writing it alone.
 */
public record SolutionOffer(String title, String url, boolean fromGenAiFund) {
}
