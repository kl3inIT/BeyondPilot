package ai.genaifund.beyondpilot.proposal.persistence;

import java.time.Instant;
import java.util.List;
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
 * A person's application to a program. Its contact details and answers are JSON the application service writes and
 * reads whole; it validates them against the program's questions.
 */
@Entity
@Table(name = "proposal")
public class Proposal {

	public static final String DRAFT = "draft";

	public static final String SUBMITTED = "submitted";

	public static final String WITHDRAWN = "withdrawn";

	public static final String UNDER_REVIEW = "under_review";

	public static final String SHORTLISTED = "shortlisted";

	public static final String NOT_SELECTED = "not_selected";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID programId;

	@Column(nullable = false, updatable = false)
	private UUID accountId;

	private @Nullable UUID organizationId;

	private @Nullable UUID solutionId;

	@Column(nullable = false)
	private String status = DRAFT;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String contact = "{}";

	private @Nullable String teamBackground;

	private @Nullable UUID deckFileId;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] builtWith = {};

	private @Nullable String traction;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String answers = "{}";

	@Column(nullable = false)
	private int submissions;

	private @Nullable Instant submittedAt;

	private @Nullable Instant withdrawnAt;

	/**
	 * GenAI Fund's decision, internal until the outcomes are released. It is written by its own statement, so a
	 * decision neither changes the application's version under an applicant who is editing it nor when it last changed.
	 */
	@Column(nullable = false, insertable = false, updatable = false)
	private String reviewStatus = UNDER_REVIEW;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected Proposal() {
	}

	@SuppressWarnings("NullAway.Init")
	public Proposal(UUID id, UUID programId, UUID accountId) {
		this.id = id;
		this.programId = programId;
		this.accountId = accountId;
	}

	/** Keeps what the form holds now. A withdrawn application that is changed is a draft again. */
	public void write(String contact, @Nullable String teamBackground, @Nullable UUID organizationId,
			@Nullable UUID solutionId, @Nullable UUID deckFileId, List<String> builtWith, @Nullable String traction,
			String answers) {
		this.contact = contact;
		this.teamBackground = teamBackground;
		this.deckFileId = deckFileId;
		this.builtWith = builtWith.toArray(String[]::new);
		this.traction = traction;
		this.organizationId = organizationId;
		this.solutionId = solutionId;
		this.answers = answers;
		if (WITHDRAWN.equals(status)) {
			status = DRAFT;
			withdrawnAt = null;
		}
	}

	public void belongTo(UUID organizationId) {
		this.organizationId = organizationId;
	}

	/**
	 * Submits what the form holds.
	 * @return the number of the version this submission makes
	 */
	public int submit(Instant at) {
		status = SUBMITTED;
		submittedAt = at;
		withdrawnAt = null;
		return ++submissions;
	}

	public void withdraw(Instant at) {
		status = WITHDRAWN;
		withdrawnAt = at;
	}

	public boolean isSubmitted() {
		return SUBMITTED.equals(status);
	}

	public UUID getId() {
		return id;
	}

	public UUID getProgramId() {
		return programId;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public @Nullable UUID getOrganizationId() {
		return organizationId;
	}

	public @Nullable UUID getSolutionId() {
		return solutionId;
	}

	public String getStatus() {
		return status;
	}

	public String getContact() {
		return contact;
	}

	public @Nullable String getTeamBackground() {
		return teamBackground;
	}

	public @Nullable UUID getDeckFileId() {
		return deckFileId;
	}

	public List<String> getBuiltWith() {
		return List.of(builtWith);
	}

	public @Nullable String getTraction() {
		return traction;
	}

	public String getAnswers() {
		return answers;
	}

	public int getSubmissions() {
		return submissions;
	}

	public @Nullable Instant getSubmittedAt() {
		return submittedAt;
	}

	public @Nullable Instant getWithdrawnAt() {
		return withdrawnAt;
	}

	public String getReviewStatus() {
		return reviewStatus;
	}

	public long getVersion() {
		return version;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
