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

/** An AI provider an operator connected. Its key is stored sealed; this entity never holds one in clear. */
@Entity
@Table(name = "ai_provider")
public class AiProvider {

	public static final String EMBEDDING = "embedding";

	public static final String CHAT = "chat";

	public static final String OCR = "ocr";

	@Id
	private UUID id;

	@Column(nullable = false)
	private String purpose;

	/** The vendor of an embedding provider, which fixes its address and models; null for a chat or OCR provider. */
	private @Nullable String vendor;

	/** The adapter that speaks this provider's API. */
	@Column(nullable = false)
	private String adapterType;

	@Column(nullable = false)
	private boolean enabled;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String baseUrl;

	private byte @Nullable [] apiKey;

	/** What 1,000 calls cost in US dollars, for a service that bills by the call; null when nobody entered it. */
	@Column(name = "price_per_1k_calls")
	private @Nullable BigDecimal pricePerThousandCalls;

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
		this.adapterType = "";
		this.enabled = true;
		this.name = "";
		this.baseUrl = "";
		this.updatedBy = new UUID(0, 0);
		this.updatedByLabel = "";
		this.updatedAt = Instant.EPOCH;
	}

	public AiProvider(String purpose, UUID createdBy, String createdByLabel, Instant at) {
		this.id = UUID.randomUUID();
		this.purpose = purpose;
		this.adapterType = "";
		this.enabled = true;
		this.name = "";
		this.baseUrl = "";
		this.updatedBy = createdBy;
		this.updatedByLabel = createdByLabel;
		this.updatedAt = at;
	}

	/** Replaces where the provider is reached and its key, passed sealed: a null key is cleared. */
	public void connectWith(@Nullable String vendor, String adapterType, String name, String baseUrl,
			byte @Nullable [] apiKey, boolean enabled) {
		this.vendor = vendor;
		this.adapterType = adapterType;
		this.enabled = enabled;
		this.name = name;
		this.baseUrl = baseUrl;
		this.apiKey = apiKey;
	}

	/** What 1,000 calls cost in US dollars from now on; null when it is not known. */
	public void price(@Nullable BigDecimal pricePerThousandCalls) {
		this.pricePerThousandCalls = pricePerThousandCalls;
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

	public @Nullable String getVendor() {
		return vendor;
	}

	public String getAdapterType() {
		return adapterType;
	}

	public boolean isEnabled() {
		return enabled;
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

	public @Nullable BigDecimal getPricePerThousandCalls() {
		return pricePerThousandCalls;
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
