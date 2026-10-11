package ai.genaifund.beyondpilot.proposal.persistence;

import java.io.Serializable;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/** A solution of the organization that a proposal offers, whatever its review says. */
@Entity
@Table(name = "use_case_proposal_solution")
@IdClass(UseCaseProposalSolution.Key.class)
public class UseCaseProposalSolution {

	@Id
	private UUID proposalId;

	@Id
	private UUID solutionId;

	@Column(nullable = false)
	private int position;

	@SuppressWarnings("NullAway.Init")
	protected UseCaseProposalSolution() {
	}

	public UseCaseProposalSolution(UUID proposalId, UUID solutionId, int position) {
		this.proposalId = proposalId;
		this.solutionId = solutionId;
		this.position = position;
	}

	public UUID getProposalId() {
		return proposalId;
	}

	public UUID getSolutionId() {
		return solutionId;
	}

	public int getPosition() {
		return position;
	}

	/** The identifier of an offered solution: the proposal and the solution. */
	public record Key(UUID proposalId, UUID solutionId) implements Serializable {

		@SuppressWarnings("NullAway")
		public Key() {
			this(null, null);
		}
	}
}
