package ai.genaifund.beyondpilot.proposal.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.jspecify.annotations.Nullable;

/** One change of GenAI Fund's decision on an application, with its private reason. It never changes. */
@Entity
@Table(name = "proposal_review_decision")
public class ProposalReviewDecision {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID proposalId;

	@Column(nullable = false, updatable = false)
	private UUID accountId;

	@Column(nullable = false, updatable = false)
	private String fromStatus;

	@Column(nullable = false, updatable = false)
	private String toStatus;

	@Column(updatable = false)
	private @Nullable String reason;

	@Column(nullable = false, updatable = false)
	private Instant decidedAt;

	@SuppressWarnings("NullAway.Init")
	protected ProposalReviewDecision() {
	}

	public ProposalReviewDecision(UUID id, UUID proposalId, UUID accountId, String fromStatus, String toStatus,
			@Nullable String reason, Instant decidedAt) {
		this.id = id;
		this.proposalId = proposalId;
		this.accountId = accountId;
		this.fromStatus = fromStatus;
		this.toStatus = toStatus;
		this.reason = reason;
		this.decidedAt = decidedAt;
	}

	public UUID getProposalId() {
		return proposalId;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public String getFromStatus() {
		return fromStatus;
	}

	public String getToStatus() {
		return toStatus;
	}

	public @Nullable String getReason() {
		return reason;
	}

	public Instant getDecidedAt() {
		return decidedAt;
	}
}
