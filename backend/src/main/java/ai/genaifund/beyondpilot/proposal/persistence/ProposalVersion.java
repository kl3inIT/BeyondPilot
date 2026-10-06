package ai.genaifund.beyondpilot.proposal.persistence;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** What one submission of an application held, as it was sent. It never changes. */
@Entity
@Table(name = "proposal_version")
@IdClass(ProposalVersion.Key.class)
public class ProposalVersion {

	@Id
	private UUID proposalId;

	@Id
	private int number;

	@Column(nullable = false, updatable = false)
	private Instant submittedAt;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, updatable = false, columnDefinition = "jsonb")
	private String snapshot;

	@SuppressWarnings("NullAway.Init")
	protected ProposalVersion() {
	}

	public ProposalVersion(UUID proposalId, int number, Instant submittedAt, String snapshot) {
		this.proposalId = proposalId;
		this.number = number;
		this.submittedAt = submittedAt;
		this.snapshot = snapshot;
	}

	public UUID getProposalId() {
		return proposalId;
	}

	public int getNumber() {
		return number;
	}

	public Instant getSubmittedAt() {
		return submittedAt;
	}

	public String getSnapshot() {
		return snapshot;
	}

	/** The identifier of a version: its application and its number. */
	public record Key(UUID proposalId, int number) implements Serializable {

		@SuppressWarnings("NullAway")
		public Key() {
			this(null, 0);
		}
	}
}
