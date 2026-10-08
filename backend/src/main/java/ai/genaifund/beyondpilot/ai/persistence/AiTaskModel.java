package ai.genaifund.beyondpilot.ai.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/** The model a task uses and how hard it reasons. One row per task; a task without a model does not run. */
@Entity
@Table(name = "ai_task_model")
public class AiTaskModel {

	@Id
	private String task;

	private @Nullable UUID modelId;

	private @Nullable String reasoningEffort;

	@Version
	private long version;

	private @Nullable UUID updatedBy;

	private @Nullable String updatedByLabel;

	@Column(nullable = false)
	private Instant updatedAt;

	protected AiTaskModel() {
		this.task = "";
		this.updatedAt = Instant.EPOCH;
	}

	/** Uses this model from now on; a null model leaves the task unset. */
	public void use(@Nullable UUID modelId, @Nullable String reasoningEffort, UUID accountId, String label, Instant at) {
		this.modelId = modelId;
		this.reasoningEffort = reasoningEffort;
		this.updatedBy = accountId;
		this.updatedByLabel = label;
		this.updatedAt = at;
	}

	public String getTask() {
		return task;
	}

	public @Nullable UUID getModelId() {
		return modelId;
	}

	public @Nullable String getReasoningEffort() {
		return reasoningEffort;
	}

	public long getVersion() {
		return version;
	}

}
