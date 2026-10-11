package ai.genaifund.beyondpilot.proposal.persistence;

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
 * What an organization sends to one use case. It is a working copy until it is sent, and the members of the
 * organization share it. The sender's talent profile is JSON the application service writes once, when it sends.
 */
@Entity
@Table(name = "use_case_proposal")
public class UseCaseProposal {

	public static final String DRAFT = "draft";

	public static final String SENT = "sent";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID useCaseId;

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column(nullable = false, updatable = false)
	private UUID createdByAccountId;

	private @Nullable UUID sentByAccountId;

	private @Nullable String approach;

	private @Nullable UUID deckFileId;

	private @Nullable UUID primaryContactAccountId;

	@Column(nullable = false)
	private String status = DRAFT;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private @Nullable String talent;

	private @Nullable Instant sentAt;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected UseCaseProposal() {
	}

	@SuppressWarnings("NullAway.Init")
	public UseCaseProposal(UUID id, UUID useCaseId, UUID organizationId, UUID createdByAccountId) {
		this.id = id;
		this.useCaseId = useCaseId;
		this.organizationId = organizationId;
		this.createdByAccountId = createdByAccountId;
	}

	/**
	 * Keeps what the form holds now. The time it is kept is written too, so every save moves the version on, even one
	 * that only changes the team, which another table holds.
	 */
	public void write(@Nullable String approach, @Nullable UUID deckFileId,
			@Nullable UUID primaryContactAccountId, Instant at) {
		this.approach = approach;
		this.deckFileId = deckFileId;
		this.primaryContactAccountId = primaryContactAccountId;
		this.updatedAt = at;
	}

	/** Makes the proposal sent, with the sender's profile as it is now. */
	public void send(UUID sender, String talent, Instant at) {
		this.status = SENT;
		this.sentByAccountId = sender;
		this.talent = talent;
		this.sentAt = at;
	}

	public boolean isSent() {
		return SENT.equals(status);
	}

	public UUID getId() {
		return id;
	}

	public UUID getUseCaseId() {
		return useCaseId;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getCreatedByAccountId() {
		return createdByAccountId;
	}

	public @Nullable UUID getSentByAccountId() {
		return sentByAccountId;
	}

	public @Nullable String getApproach() {
		return approach;
	}

	public @Nullable UUID getDeckFileId() {
		return deckFileId;
	}

	public @Nullable UUID getPrimaryContactAccountId() {
		return primaryContactAccountId;
	}

	public String getStatus() {
		return status;
	}

	public @Nullable String getTalent() {
		return talent;
	}

	public @Nullable Instant getSentAt() {
		return sentAt;
	}

	public long getVersion() {
		return version;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
