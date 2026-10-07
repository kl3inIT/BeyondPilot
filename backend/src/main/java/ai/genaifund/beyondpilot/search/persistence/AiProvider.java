package ai.genaifund.beyondpilot.search.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/** An AI provider an operator connected. Its key is stored sealed; this entity never holds one in clear. */
@Entity
@Table(name = "ai_provider")
public class AiProvider {

	public static final String EMBEDDING = "embedding";

	@Id
	private UUID id;

	@Column(nullable = false)
	private String purpose;

	@Column(nullable = false)
	private String vendor;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String baseUrl;

	private byte @Nullable [] apiKey;

	@Version
	private long version;

	@Column(nullable = false)
	private UUID updatedBy;

	@Column(nullable = false)
	private String updatedByLabel;

	@Column(nullable = false)
	private Instant updatedAt;

	protected AiProvider() {
		this.id = UUID.randomUUID();
		this.purpose = EMBEDDING;
		this.vendor = "";
		this.name = "";
		this.baseUrl = "";
		this.updatedBy = new UUID(0, 0);
		this.updatedByLabel = "";
		this.updatedAt = Instant.EPOCH;
	}

	public AiProvider(String purpose, UUID createdBy, String createdByLabel, Instant at) {
		this.id = UUID.randomUUID();
		this.purpose = purpose;
		this.vendor = "";
		this.name = "";
		this.baseUrl = "";
		this.updatedBy = createdBy;
		this.updatedByLabel = createdByLabel;
		this.updatedAt = at;
	}

	/** Replaces where the provider is reached and its key, passed sealed: a null key is cleared. */
	public void connectWith(String vendor, String name, String baseUrl, byte @Nullable [] apiKey) {
		this.vendor = vendor;
		this.name = name;
		this.baseUrl = baseUrl;
		this.apiKey = apiKey;
	}

	/** Records who changed the provider, as they were named, and when. */
	public void changedBy(UUID accountId, String label, Instant at) {
		this.updatedBy = accountId;
		this.updatedByLabel = label;
		this.updatedAt = at;
	}

	public UUID getId() {
		return id;
	}

	public String getPurpose() {
		return purpose;
	}

	public String getVendor() {
		return vendor;
	}

	public String getName() {
		return name;
	}

	public String getBaseUrl() {
		return baseUrl;
	}

	public byte @Nullable [] getApiKey() {
		return apiKey;
	}

	public long getVersion() {
		return version;
	}

	public String getUpdatedByLabel() {
		return updatedByLabel;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
