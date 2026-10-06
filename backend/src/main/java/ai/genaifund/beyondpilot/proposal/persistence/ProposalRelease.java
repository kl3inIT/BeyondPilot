package ai.genaifund.beyondpilot.proposal.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** The release of a program's outcomes, with the email each group was sent. It happens once and never changes. */
@Entity
@Table(name = "proposal_release")
public class ProposalRelease {

	@Id
	private UUID programId;

	@Column(nullable = false, updatable = false)
	private Instant releasedAt;

	@Column(nullable = false, updatable = false)
	private UUID releasedByAccountId;

	@Column(nullable = false, updatable = false)
	private String shortlistedSubject;

	@Column(nullable = false, updatable = false)
	private String shortlistedMessage;

	@Column(nullable = false, updatable = false)
	private String notSelectedSubject;

	@Column(nullable = false, updatable = false)
	private String notSelectedMessage;

	@SuppressWarnings("NullAway.Init")
	protected ProposalRelease() {
	}

	public ProposalRelease(UUID programId, Instant releasedAt, UUID releasedByAccountId, String shortlistedSubject,
			String shortlistedMessage, String notSelectedSubject, String notSelectedMessage) {
		this.programId = programId;
		this.releasedAt = releasedAt;
		this.releasedByAccountId = releasedByAccountId;
		this.shortlistedSubject = shortlistedSubject;
		this.shortlistedMessage = shortlistedMessage;
		this.notSelectedSubject = notSelectedSubject;
		this.notSelectedMessage = notSelectedMessage;
	}

	public UUID getProgramId() {
		return programId;
	}

	public Instant getReleasedAt() {
		return releasedAt;
	}

	public UUID getReleasedByAccountId() {
		return releasedByAccountId;
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
