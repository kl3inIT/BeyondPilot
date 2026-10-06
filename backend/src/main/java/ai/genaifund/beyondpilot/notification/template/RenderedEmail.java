package ai.genaifund.beyondpilot.notification.template;

/** One email as its recipient reads it: the subject line and the same content as HTML and as plain text. */
public record RenderedEmail(String subject, String html, String text) {
}
