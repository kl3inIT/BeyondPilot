package ai.genaifund.beyondpilot.ai.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/**
 * The model a task uses and how hard it reasons. One row per task; a task without a model does not run. Document
 * reading may name an OCR provider in place of a model.
 */
@Entity
@Table(name = "ai_task_model")
public class AiTaskModel {

	@Id
	private String task;

	private @Nullable UUID modelId;

	private @Nullable String reasoningEffort;

	private @Nullable UUID ocrProviderId;

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
		this.ocrProviderId = null;
		this.updatedBy = accountId;
		this.updatedByLabel = label;
		this.updatedAt = at;
	}

	/** Reads pages with this OCR provider from now on, in place of a model. */
	public void readWith(UUID ocrProviderId, UUID accountId, String label, Instant at) {
		this.modelId = null;
		this.ocrProviderId = ocrProviderId;
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

	public @Nullable UUID getOcrProviderId() {
		return ocrProviderId;
	}

	public long getVersion() {
		return version;
	}

}
