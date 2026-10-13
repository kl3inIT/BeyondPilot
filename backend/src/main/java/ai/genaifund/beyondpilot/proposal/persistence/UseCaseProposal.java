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

	public static final String SHORTLISTED = "shortlisted";

	public static final String DECLINED = "declined";

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

	private @Nullable String teamBackground;

	@Column(nullable = false)
	private String status = DRAFT;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private @Nullable String talent;

	private @Nullable Instant sentAt;

	private @Nullable Instant editedAt;

	private @Nullable Instant withdrawnAt;

	/** What the organization that posted the use case decided: shortlisted or declined; null while undecided. */
	private @Nullable String decision;

	private @Nullable Instant decidedAt;

	private @Nullable UUID decidedByAccountId;

	/** The decision last told to the sender; null until the outcomes were sent. */
	private @Nullable String outcome;

	private @Nullable Instant outcomeSentAt;

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
	 * that only changes the solutions, which another table holds.
	 */
	public void write(@Nullable String approach, @Nullable String teamBackground, @Nullable UUID deckFileId,
			Instant at) {
		this.approach = approach;
		this.teamBackground = teamBackground;
		this.deckFileId = deckFileId;
		this.updatedAt = at;
	}

	/**
	 * Keeps what the form holds now for a proposal that was already sent; the sender and the snapshot stay as sent, and
	 * the time of the change is noted.
	 */
	public void edit(@Nullable String approach, @Nullable String teamBackground, @Nullable UUID deckFileId,
			Instant at) {
		write(approach, teamBackground, deckFileId, at);
		this.editedAt = at;
	}

	/** Makes the proposal sent by this account, whether it was never sent or was taken back. */
	public void send(UUID sender, Instant at) {
		this.status = SENT;
		this.sentByAccountId = sender;
		this.sentAt = at;
		this.withdrawnAt = null;
	}

	/**
	 * Takes a sent proposal back: it is a draft again, with what the form held, and says when it was taken back. What
	 * belonged to its sending, who sent it and when and the copy of the sender's profile, goes.
	 */
	public void withdraw(Instant at) {
		this.status = DRAFT;
		this.sentByAccountId = null;
		this.sentAt = null;
		this.editedAt = null;
		this.talent = null;
		this.withdrawnAt = at;
		this.updatedAt = at;
		this.decision = null;
		this.decidedAt = null;
		this.decidedByAccountId = null;
		this.outcome = null;
		this.outcomeSentAt = null;
	}

	/** Records the decision of a member of the organization that posted the use case, or of an operator. */
	public void decide(String decision, UUID by, Instant at) {
		this.decision = decision;
		this.decidedByAccountId = by;
		this.decidedAt = at;
	}

	/** Notes that the sender was told the decision as it is now. */
	public void communicate(Instant at) {
		this.outcome = decision;
		this.outcomeSentAt = at;
	}

	/** Whether the decision is set and is not the one the sender was last told. */
	public boolean outcomePending() {
		return decision != null && !decision.equals(outcome);
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

	public @Nullable String getTeamBackground() {
		return teamBackground;
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

	public @Nullable Instant getEditedAt() {
		return editedAt;
	}

	public @Nullable Instant getWithdrawnAt() {
		return withdrawnAt;
	}

	public @Nullable String getDecision() {
		return decision;
	}

	public @Nullable Instant getDecidedAt() {
		return decidedAt;
	}

	public @Nullable UUID getDecidedByAccountId() {
		return decidedByAccountId;
	}

	public @Nullable String getOutcome() {
		return outcome;
	}

	public @Nullable Instant getOutcomeSentAt() {
		return outcomeSentAt;
	}

	public long getVersion() {
		return version;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
