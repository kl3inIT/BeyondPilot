package ai.genaifund.beyondpilot.program.persistence;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

/**
 * A person's registration for a Luma event on BeyondPilot (BEY-245). It is kept before Luma is called, so Luma being
 * down loses nothing; a job sends it and retries. The status is the one asked for until Luma says otherwise.
 */
@Entity
@Table(name = "program_luma_registration")
public class LumaRegistration {

	public static final String WAITING = "waiting";

	public static final String SENT = "sent";

	public static final String FAILED = "failed";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID programId;

	@Column(nullable = false, updatable = false)
	private UUID accountId;

	@Column(nullable = false, updatable = false)
	private String email;

	@Column(nullable = false, updatable = false)
	private String name;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, updatable = false, columnDefinition = "jsonb")
	private String answers;

	@Column(nullable = false, updatable = false)
	private String formVersion;

	@Column(nullable = false)
	private String status;

	@Column(nullable = false)
	private String sendState = WAITING;

	private @Nullable String sendError;

	@Column(nullable = false)
	private int attempts;

	@Column(nullable = false)
	private Instant nextAttemptAt;

	private @Nullable Instant sentAt;

	private @Nullable String lumaGuestId;

	private @Nullable String checkInUrl;

	@Column(nullable = false, updatable = false)
	private String ticket;

	private @Nullable String emailedStatus;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@Version
	private long version;

	@SuppressWarnings("NullAway.Init")
	protected LumaRegistration() {
	}

	/**
	 * A registration waiting to be sent at once.
	 * @param answers the answers with their questions as asked, as JSON
	 * @param status the status Luma is asked to add the guest with
	 * @param ticket the unguessable token of the guest's QR code and calendar file
	 */
	@SuppressWarnings("NullAway.Init")
	public LumaRegistration(UUID programId, UUID accountId, String email, String name, String answers,
			String formVersion, String status, String ticket, Instant now) {
		this.id = UUID.randomUUID();
		this.programId = programId;
		this.accountId = accountId;
		this.email = email;
		this.name = name;
		this.answers = answers;
		this.formVersion = formVersion;
		this.status = status;
		this.ticket = ticket;
		this.nextAttemptAt = now;
	}

	/** Luma has the guest, under this identifier when it was found, in the status it gave. */
	public void sent(@Nullable String guestId, String status, @Nullable String checkInUrl, Instant now) {
		this.sendState = SENT;
		this.sendError = null;
		this.sentAt = now;
		this.lumaGuestId = guestId;
		this.status = status;
		this.checkInUrl = checkInUrl;
	}

	/** An attempt failed; the next comes after the wait given. */
	public void retryAfter(Duration wait, String error, Instant now) {
		this.attempts++;
		this.sendError = error;
		this.nextAttemptAt = now.plus(wait);
	}

	/** Sending stopped for the reason given, until an operator tries again. */
	public void failed(String error) {
		this.attempts++;
		this.sendState = FAILED;
		this.sendError = error;
	}

	/** The person was told of the status they are in now. */
	public void emailed() {
		this.emailedStatus = status;
	}

	public UUID getId() {
		return id;
	}

	public UUID getProgramId() {
		return programId;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public String getEmail() {
		return email;
	}

	public String getName() {
		return name;
	}

	public String getAnswers() {
		return answers;
	}

	public String getFormVersion() {
		return formVersion;
	}

	public String getStatus() {
		return status;
	}

	public String getSendState() {
		return sendState;
	}

	public @Nullable String getSendError() {
		return sendError;
	}

	public int getAttempts() {
		return attempts;
	}

	public Instant getNextAttemptAt() {
		return nextAttemptAt;
	}

	public @Nullable Instant getSentAt() {
		return sentAt;
	}

	public @Nullable String getLumaGuestId() {
		return lumaGuestId;
	}

	public @Nullable String getCheckInUrl() {
		return checkInUrl;
	}

	public String getTicket() {
		return ticket;
	}

	public @Nullable String getEmailedStatus() {
		return emailedStatus;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
