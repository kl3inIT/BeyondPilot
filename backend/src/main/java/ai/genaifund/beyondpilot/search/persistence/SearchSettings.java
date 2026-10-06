package ai.genaifund.beyondpilot.search.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/** The one row of how search uses embeddings: the provider and model, and whether semantic search is on. */
@Entity
@Table(name = "search_settings")
public class SearchSettings {

	public static final short ID = 1;

	@Id
	private short id;

	@Column(nullable = false)
	private boolean semanticEnabled;

	private @Nullable UUID providerId;

	private @Nullable String model;

	private @Nullable Instant modelSince;

	@Version
	private long version;

	private @Nullable UUID updatedBy;

	private @Nullable String updatedByLabel;

	@Column(nullable = false)
	private Instant updatedAt;

	protected SearchSettings() {
		this.semanticEnabled = true;
		this.updatedAt = Instant.EPOCH;
	}

	/** Embeds with this provider's model from now on; a change of model counts from now. */
	public void embedWith(UUID providerId, String model, Instant at) {
		if (!model.equals(this.model)) {
			this.modelSince = at;
		}
		this.providerId = providerId;
		this.model = model;
	}

	public void semantic(boolean enabled) {
		this.semanticEnabled = enabled;
	}

	/** Records who changed the settings, as they were named, and when. */
	public void changedBy(UUID accountId, String label, Instant at) {
		this.updatedBy = accountId;
		this.updatedByLabel = label;
		this.updatedAt = at;
	}

	public boolean isSemanticEnabled() {
		return semanticEnabled;
	}

	public @Nullable UUID getProviderId() {
		return providerId;
	}

	public @Nullable String getModel() {
		return model;
	}

	public @Nullable Instant getModelSince() {
		return modelSince;
	}

	public long getVersion() {
		return version;
	}

}
