package ai.genaifund.beyondpilot.ai;

/**
 * What a call to a chat model is about, as the caller names it, so the usage record can be read by use case or
 * application later. It is an identifier, never content.
 */
public record AiSubject(String type, String id) {
}
