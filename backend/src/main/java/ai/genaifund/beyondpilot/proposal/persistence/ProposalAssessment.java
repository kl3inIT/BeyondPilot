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
 * private note, on the version they read.
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
	private boolean bookmarked;

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

	public void write(int versionNumber, String scores, @Nullable String note, boolean bookmarked, Instant at) {
		this.versionNumber = versionNumber;
		this.scores = scores;
		this.note = note;
		this.bookmarked = bookmarked;
		this.savedAt = at;
	}

	/** Whether every criterion was scored; a note or a bookmark alone holds no scores. */
	public boolean isScored() {
		return !"{}".equals(scores);
	}

	public boolean isBookmarked() {
		return bookmarked;
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
