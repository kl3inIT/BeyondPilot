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
import org.jspecify.annotations.Nullable;

/**
 * One person's assessment of an application: a score for each criterion, as JSON by criterion identifier, and a
 * private note, on the version they read. A conflict of interest holds no scores.
 */
@Entity
@Table(name = "proposal_assessment")
@IdClass(ProposalAssessment.Key.class)
public class ProposalAssessment {

	@Id
	private UUID proposalId;

	@Id
	private UUID accountId;

	@Column(nullable = false)
	private int versionNumber;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String scores = "{}";

	private @Nullable String note;

	@Column(nullable = false)
	private boolean conflict;

	@Column(nullable = false)
	private Instant savedAt;

	@SuppressWarnings("NullAway.Init")
	protected ProposalAssessment() {
	}

	@SuppressWarnings("NullAway.Init")
	public ProposalAssessment(UUID proposalId, UUID accountId) {
		this.proposalId = proposalId;
		this.accountId = accountId;
	}

	public void write(int versionNumber, String scores, @Nullable String note, boolean conflict, Instant at) {
		this.versionNumber = versionNumber;
		this.scores = scores;
		this.note = note;
		this.conflict = conflict;
		this.savedAt = at;
	}

	public UUID getProposalId() {
		return proposalId;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public int getVersionNumber() {
		return versionNumber;
	}

	public String getScores() {
		return scores;
	}

	public @Nullable String getNote() {
		return note;
	}

	public boolean isConflict() {
		return conflict;
	}

	public Instant getSavedAt() {
		return savedAt;
	}

	/** The identifier of an assessment: its application and its author. */
	public record Key(UUID proposalId, UUID accountId) implements Serializable {

		@SuppressWarnings("NullAway")
		public Key() {
			this(null, null);
		}
	}
}
