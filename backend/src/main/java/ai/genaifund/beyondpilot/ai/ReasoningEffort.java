package ai.genaifund.beyondpilot.ai;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/** How hard a task asks its model to reason. Each adapter asks for it the way its API does. */
public enum ReasoningEffort {

	OFF, LOW, MEDIUM, HIGH;

	/** The value stored and sent over HTTP. */
	public String value() {
		return name().toLowerCase(Locale.ROOT);
	}

	public static Optional<ReasoningEffort> of(String value) {
		return Arrays.stream(values()).filter(effort -> effort.value().equals(value)).findFirst();
	}

}
