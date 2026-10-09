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
	MATCHING(ReasoningEffort.MEDIUM, false),

	/** Copies the text of a page that is only a picture: a slide of a deck, an attached scan. */
	DOCUMENT_READING(ReasoningEffort.LOW, true);

	private final ReasoningEffort defaultEffort;

	private final boolean readsImages;

	AiTask(ReasoningEffort defaultEffort, boolean readsImages) {
		this.defaultEffort = defaultEffort;
		this.readsImages = readsImages;
	}

	/** Whether the task sends pictures, so that only a model that reads images can be chosen for it. */
	public boolean readsImages() {
		return readsImages;
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
