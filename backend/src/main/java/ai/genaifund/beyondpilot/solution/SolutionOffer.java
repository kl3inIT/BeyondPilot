package ai.genaifund.beyondpilot.solution;

/**
 * An offer a solution comes with, as another module reads it: the line that names it, the https address where it
 * is claimed, and whether it is of GenAI Fund's list rather than the organization's own.
 */
public record SolutionOffer(String title, String url, boolean fromGenAiFund) {
}
