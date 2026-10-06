package ai.genaifund.beyondpilot.notification.template;

import org.jspecify.annotations.Nullable;

/**
 * Why a template cannot be used.
 * @param field {@code subject} or {@code body}
 * @param variable the variable concerned; null when the problem is the syntax
 */
public record TemplateProblem(Type type, String field, @Nullable String variable) {

	public enum Type {

		/** The text does not parse as a template, or uses a tag templates may not use. */
		SYNTAX,

		/** A tag names something the kind does not offer. */
		UNKNOWN_VARIABLE,

		/** A variable the email exists for is missing. */
		MISSING_VARIABLE,

		/** The subject runs over one line or is empty. */
		SUBJECT_LINE

	}

}
