package ai.genaifund.beyondpilot.notification.template;

import java.util.Objects;

/**
 * The wording of one kind of email in one language.
 * @param subject a single line; may use the kind's variables
 * @param body Markdown; may use the kind's variables
 */
public record EmailTemplate(String subject, String body) {

	public EmailTemplate {
		Objects.requireNonNull(subject, "subject must not be null");
		Objects.requireNonNull(body, "body must not be null");
	}

}
