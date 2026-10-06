package ai.genaifund.beyondpilot.program.persistence;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

/**
 * One question a program asks its applicants.
 * @param id what an answer names, kept while the question is edited
 * @param kind {@code short_text}, {@code long_text}, {@code single_choice}, {@code file}, {@code link} or
 * {@code confirm}
 * @param options the choices of a {@code single_choice} question, in order; empty otherwise
 * @param maxLength the longest answer to a text question; null takes the form's default
 */
@Embeddable
public record ProgramQuestion(UUID id, String kind, String label, @Nullable String help, boolean required,
		@JdbcTypeCode(SqlTypes.ARRAY) @Column(columnDefinition = "text[]") String[] options,
		@Nullable Integer maxLength) {

	public static final String SINGLE_CHOICE = "single_choice";
}
