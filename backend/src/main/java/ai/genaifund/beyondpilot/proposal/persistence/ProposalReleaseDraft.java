package ai.genaifund.beyondpilot.proposal.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The emails of a release as an operator is writing them. One row per program, kept until its outcomes are released.
 * A subject or a message may be empty while it is written.
 */
@Entity
@Table(name = "proposal_release_draft")
public class ProposalReleaseDraft {

	@Id
	private UUID programId;

	@Column(nullable = false)
	private String shortlistedSubject;

	@Column(nullable = false)
	private String shortlistedMessage;

	@Column(nullable = false)
	private String notSelectedSubject;

	@Column(nullable = false)
	private String notSelectedMessage;

	@Column(nullable = false)
	private UUID updatedByAccountId;

	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected ProposalReleaseDraft() {
	}

	@SuppressWarnings("NullAway.Init")
	public ProposalReleaseDraft(UUID programId) {
		this.programId = programId;
	}

	/** Keeps the emails as they are written now. */
	public void write(String shortlistedSubject, String shortlistedMessage, String notSelectedSubject,
			String notSelectedMessage, UUID accountId, Instant at) {
		this.shortlistedSubject = shortlistedSubject;
		this.shortlistedMessage = shortlistedMessage;
		this.notSelectedSubject = notSelectedSubject;
		this.notSelectedMessage = notSelectedMessage;
		this.updatedByAccountId = accountId;
		this.updatedAt = at;
	}

	public UUID getProgramId() {
		return programId;
	}

	public String getShortlistedSubject() {
		return shortlistedSubject;
	}

	public String getShortlistedMessage() {
		return shortlistedMessage;
	}

	public String getNotSelectedSubject() {
		return notSelectedSubject;
	}

	public String getNotSelectedMessage() {
		return notSelectedMessage;
	}

}
