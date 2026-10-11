package ai.genaifund.beyondpilot.proposal.persistence;

import java.io.Serializable;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/** A person of the organization a proposal names, with the role typed for that proposal. */
@Entity
@Table(name = "use_case_proposal_member")
@IdClass(UseCaseProposalMember.Key.class)
public class UseCaseProposalMember {

	@Id
	private UUID proposalId;

	@Id
	private UUID accountId;

	@Column(nullable = false)
	private int position;

	@Column(nullable = false)
	private String role;

	@SuppressWarnings("NullAway.Init")
	protected UseCaseProposalMember() {
	}

	public UseCaseProposalMember(UUID proposalId, UUID accountId, int position, String role) {
		this.proposalId = proposalId;
		this.accountId = accountId;
		this.position = position;
		this.role = role;
	}

	public UUID getProposalId() {
		return proposalId;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public int getPosition() {
		return position;
	}

	public String getRole() {
		return role;
	}

	/** The identifier of a member: the proposal and the account. */
	public record Key(UUID proposalId, UUID accountId) implements Serializable {

		@SuppressWarnings("NullAway")
		public Key() {
			this(null, null);
		}
	}
}
