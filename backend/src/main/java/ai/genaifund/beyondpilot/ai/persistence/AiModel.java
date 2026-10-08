package ai.genaifund.beyondpilot.ai.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/** A model of a chat provider that an operator enabled, with its limits, capabilities and prices. */
@Entity
@Table(name = "ai_model")
public class AiModel {

	@Id
	private UUID id;

	@Column(nullable = false)
	private UUID providerId;

	@Column(nullable = false)
	private String modelName;

	@Column(nullable = false)
	private String displayName;

	@Column(nullable = false)
	private int contextWindow;

	private @Nullable Integer maxOutputTokens;

	@Column(nullable = false)
	private boolean toolCalling;

	@Column(nullable = false)
	private boolean vision;

	@Column(nullable = false)
	private boolean reasoning;

	private @Nullable BigDecimal inputPrice;

	private @Nullable BigDecimal outputPrice;

	private @Nullable BigDecimal cachedInputPrice;

	@Version
	private long version;

	@Column(nullable = false)
	private UUID updatedBy;

	@Column(nullable = false)
	private String updatedByLabel;

	@Column(nullable = false)
	private Instant updatedAt;

	protected AiModel() {
		this.id = UUID.randomUUID();
		this.providerId = new UUID(0, 0);
		this.modelName = "";
		this.displayName = "";
		this.updatedBy = new UUID(0, 0);
		this.updatedByLabel = "";
		this.updatedAt = Instant.EPOCH;
	}

	public AiModel(UUID providerId, String modelName) {
		this();
		this.providerId = providerId;
		this.modelName = modelName;
	}

	/** Replaces what is known about the model. A price is in US dollars per million tokens; null is unknown. */
	public void describe(String displayName, int contextWindow, @Nullable Integer maxOutputTokens, boolean toolCalling,
			boolean vision, boolean reasoning, @Nullable BigDecimal inputPrice, @Nullable BigDecimal outputPrice,
			@Nullable BigDecimal cachedInputPrice) {
		this.displayName = displayName;
		this.contextWindow = contextWindow;
		this.maxOutputTokens = maxOutputTokens;
		this.toolCalling = toolCalling;
		this.vision = vision;
		this.reasoning = reasoning;
		this.inputPrice = inputPrice;
		this.outputPrice = outputPrice;
		this.cachedInputPrice = cachedInputPrice;
	}

	/** Records who changed the model, as they were named, and when. */
	public void changedBy(UUID accountId, String label, Instant at) {
		this.updatedBy = accountId;
		this.updatedByLabel = label;
		this.updatedAt = at;
	}

	public UUID getId() {
		return id;
	}

	public UUID getProviderId() {
		return providerId;
	}

	public String getModelName() {
		return modelName;
	}

	public String getDisplayName() {
		return displayName;
	}

	public int getContextWindow() {
		return contextWindow;
	}

	public @Nullable Integer getMaxOutputTokens() {
		return maxOutputTokens;
	}

	public boolean isToolCalling() {
		return toolCalling;
	}

	public boolean isVision() {
		return vision;
	}

	public boolean isReasoning() {
		return reasoning;
	}

	public @Nullable BigDecimal getInputPrice() {
		return inputPrice;
	}

	public @Nullable BigDecimal getOutputPrice() {
		return outputPrice;
	}

	public @Nullable BigDecimal getCachedInputPrice() {
		return cachedInputPrice;
	}

	public long getVersion() {
		return version;
	}

}
