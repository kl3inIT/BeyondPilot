package ai.genaifund.beyondpilot.search;

/**
 * An item search found: what it is and where its page is.
 * @param kind {@code program}, {@code solution}, {@code talent} or {@code use_case}
 * @param slug the address of its page under the path of its kind; a use case's identifier
 */
public record Found(String kind, String slug, String title) {
}
