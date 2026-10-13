package ai.genaifund.beyondpilot.proposal.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** One decision on a proposal a use case received: who made it, and when. It never changes. */
@Entity
@Table(name = "use_case_proposal_decision")
public class UseCaseProposalDecision {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID proposalId;

	@Column(nullable = false, updatable = false)
	private String decision;

	@Column(nullable = false, updatable = false)
	private UUID decidedByAccountId;

	@Column(nullable = false, updatable = false)
	private Instant decidedAt;

	@SuppressWarnings("NullAway.Init")
	protected UseCaseProposalDecision() {
	}

	public UseCaseProposalDecision(UUID id, UUID proposalId, String decision, UUID decidedByAccountId,
			Instant decidedAt) {
		this.id = id;
		this.proposalId = proposalId;
		this.decision = decision;
		this.decidedByAccountId = decidedByAccountId;
		this.decidedAt = decidedAt;
	}

	public UUID getId() {
		return id;
	}

	public UUID getProposalId() {
		return proposalId;
	}

	public String getDecision() {
		return decision;
	}

	public UUID getDecidedByAccountId() {
		return decidedByAccountId;
	}

	public Instant getDecidedAt() {
		return decidedAt;
	}
}
