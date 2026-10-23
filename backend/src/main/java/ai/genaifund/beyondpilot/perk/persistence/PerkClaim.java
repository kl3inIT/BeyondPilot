package ai.genaifund.beyondpilot.perk.persistence;

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
 * One getting of a perk by a person for their organization: a link opened, a code shown, or a request sent. A request
 * is waiting until its partner grants or declines it, or granted when it is sent if the perk asks for no approval.
 */
@Entity
@Table(name = "perk_claim")
public class PerkClaim {

	public static final String TAKEN = "taken";

	public static final String WAITING = "waiting";

	public static final String GRANTED = "granted";

	public static final String DECLINED = "declined";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID perkId;

	/** The organization it was got for; it moves only with a merge. */
	@Column(nullable = false)
	private UUID organizationId;

	@Column(nullable = false, updatable = false)
	private UUID accountId;

	@Column(nullable = false)
	private String state;

	/** The code it got: the shared code as it was then, or the one of the list kept for it. */
	private @Nullable String code;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String answers = "{}";

	private @Nullable UUID decidedByAccountId;

	private @Nullable Instant decidedAt;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected PerkClaim() {
	}

	@SuppressWarnings("NullAway.Init")
	public PerkClaim(UUID id, UUID perkId, UUID organizationId, UUID accountId, String state, @Nullable String code,
			String answers) {
		this.id = id;
		this.perkId = perkId;
		this.organizationId = organizationId;
		this.accountId = accountId;
		this.state = state;
		this.code = code;
		this.answers = answers;
		if (GRANTED.equals(state)) {
			// Granted as it was sent, by nobody.
			this.decidedAt = Instant.now();
		}
	}

	/** Keeps the code of the list given to it. */
	public void holdCode(String code) {
		this.code = code;
	}

	/** Grants or declines a waiting request. */
	public void decide(boolean granted, UUID accountId) {
		this.state = granted ? GRANTED : DECLINED;
		this.decidedByAccountId = accountId;
		this.decidedAt = Instant.now();
	}

	/** Whether it holds a place: anything but a declined request. */
	public boolean isActive() {
		return !DECLINED.equals(state);
	}

	public UUID getId() {
		return id;
	}

	public UUID getPerkId() {
		return perkId;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public String getState() {
		return state;
	}

	public @Nullable String getCode() {
		return code;
	}

	public String getAnswers() {
		return answers;
	}

	public @Nullable UUID getDecidedByAccountId() {
		return decidedByAccountId;
	}

	public @Nullable Instant getDecidedAt() {
		return decidedAt;
	}

	public long getVersion() {
		return version;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
