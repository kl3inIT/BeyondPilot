package ai.genaifund.beyondpilot.config;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import jakarta.validation.ConstraintViolation;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.jspecify.annotations.Nullable;
import org.springframework.validation.FieldError;

/**
 * One entry of a validation problem's {@code errors}: a JSON Pointer to the offending member, a fallback text, a stable
 * code and the constraint's numeric bounds. The rejected value is never included.
 */
record RequestViolation(String pointer, String detail, String code,
		@JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, Number> params) {

	static final Comparator<RequestViolation> ORDER = Comparator
		.<RequestViolation, String>comparing(RequestViolation::pointer)
		.thenComparing(RequestViolation::code);

	private static final Set<String> BOUNDS = Set.of("min", "max");

	static RequestViolation of(FieldError error) {
		String detail = error.getDefaultMessage();
		return new RequestViolation(pointer(error.getField()),
				detail == null || detail.isBlank() ? "Invalid value." : detail, code(error.getCode()), bounds(error));
	}

	/** {@code items[0].name} becomes {@code #/items/0/name}. */
	private static String pointer(String field) {
		List<String> segments = new ArrayList<>();
		for (String part : field.split("\\.")) {
			for (String segment : part.replace("]", "").split("\\[")) {
				segments.add(segment.replace("~", "~0").replace("/", "~1"));
			}
		}
		return "#/" + String.join("/", segments);
	}

	/** {@code NotBlank} becomes {@code NOT_BLANK}. */
	private static String code(@Nullable String constraint) {
		if (constraint == null || constraint.isBlank()) {
			return "INVALID";
		}
		return constraint.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toUpperCase(Locale.ROOT);
	}

	private static Map<String, Number> bounds(FieldError error) {
		Map<String, Number> bounds = new LinkedHashMap<>();
		if (error.contains(ConstraintViolation.class)) {
			ConstraintViolation<?> violation = error.unwrap(ConstraintViolation.class);
			violation.getConstraintDescriptor().getAttributes().forEach((name, value) -> {
				if (BOUNDS.contains(name) && value instanceof Number number) {
					bounds.put(name, number);
				}
			});
		}
		return bounds;
	}
}
