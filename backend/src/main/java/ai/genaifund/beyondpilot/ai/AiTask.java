package ai.genaifund.beyondpilot.ai;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * What BeyondPilot does with a chat model. Each task has its own model, chosen by operators in Admin › AI › Providers.
 * A task is added here with the feature that runs it, and to the check on {@code ai_task_model.task}.
 */
public enum AiTask {

	/** Judges which solutions fit a use case. */
	MATCHING(ReasoningEffort.MEDIUM);

	private final ReasoningEffort defaultEffort;

	AiTask(ReasoningEffort defaultEffort) {
		this.defaultEffort = defaultEffort;
	}

	/** The value stored and sent over HTTP. */
	public String value() {
		return name().toLowerCase(Locale.ROOT);
	}

	/** How hard the task reasons until an operator says otherwise. */
	public ReasoningEffort defaultEffort() {
		return defaultEffort;
	}

	public static Optional<AiTask> of(String value) {
		return Arrays.stream(values()).filter(task -> task.value().equals(value)).findFirst();
	}

}
