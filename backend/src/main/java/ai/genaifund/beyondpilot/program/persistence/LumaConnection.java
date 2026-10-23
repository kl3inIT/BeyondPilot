package ai.genaifund.beyondpilot.program.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/**
 * The one Luma calendar BeyondPilot reads (BEY-245): the key an operator gave and the webhook made with it. The key and
 * the webhook's secret are stored sealed; this entity never holds one in clear.
 */
@Entity
@Table(name = "program_luma_connection")
public class LumaConnection {

	public static final short ID = 1;

	@Id
	private short id;

	@Column(nullable = false)
	private byte[] apiKey;

	@Column(nullable = false)
	private String apiKeyEnding;

	@Column(nullable = false)
	private String calendarId;

	@Column(nullable = false)
	private String calendarName;

	private @Nullable String webhookId;

	private byte @Nullable [] webhookSecret;

	private @Nullable String webhookError;

	private @Nullable Instant lastReadAt;

	private @Nullable String lastReadError;

	private @Nullable UUID connectedByAccountId;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	@Version
	private long version;

	protected LumaConnection() {
		this.apiKey = new byte[0];
		this.apiKeyEnding = "";
		this.calendarId = "";
		this.calendarName = "";
		this.createdAt = Instant.EPOCH;
		this.updatedAt = Instant.EPOCH;
	}

	/** A connection to the calendar with a sealed key, given by the account. */
	public LumaConnection(byte[] apiKey, String apiKeyEnding, String calendarId, String calendarName,
			@Nullable UUID connectedByAccountId, Instant now) {
		this.id = ID;
		this.apiKey = apiKey;
		this.apiKeyEnding = apiKeyEnding;
		this.calendarId = calendarId;
		this.calendarName = calendarName;
		this.connectedByAccountId = connectedByAccountId;
		this.createdAt = now;
		this.updatedAt = now;
	}

	/** The webhook made on the calendar, with its sealed secret. */
	public void hooked(String webhookId, byte[] webhookSecret, Instant now) {
		this.webhookId = webhookId;
		this.webhookSecret = webhookSecret;
		this.webhookError = null;
		this.updatedAt = now;
	}

	/** No webhook could be made; why, in words an operator reads. */
	public void unhooked(String error, Instant now) {
		this.webhookId = null;
		this.webhookSecret = null;
		this.webhookError = error;
		this.updatedAt = now;
	}

	/** A read of the calendar ended; the error is null when it succeeded. */
	public void read(Instant at, @Nullable String error) {
		if (error == null) {
			this.lastReadAt = at;
		}
		this.lastReadError = error;
		this.updatedAt = at;
	}

	public byte[] getApiKey() {
		return apiKey;
	}

	public String getApiKeyEnding() {
		return apiKeyEnding;
	}

	public String getCalendarId() {
		return calendarId;
	}

	public String getCalendarName() {
		return calendarName;
	}

	public @Nullable String getWebhookId() {
		return webhookId;
	}

	public byte @Nullable [] getWebhookSecret() {
		return webhookSecret;
	}

	public @Nullable String getWebhookError() {
		return webhookError;
	}

	public @Nullable Instant getLastReadAt() {
		return lastReadAt;
	}

	public @Nullable String getLastReadError() {
		return lastReadError;
	}

	public @Nullable UUID getConnectedByAccountId() {
		return connectedByAccountId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
