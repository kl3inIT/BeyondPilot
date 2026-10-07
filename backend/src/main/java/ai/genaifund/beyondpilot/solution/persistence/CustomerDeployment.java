package ai.genaifund.beyondpilot.solution.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;

/**
 * One project in which a customer put a solution to work. It waits for review from the moment it is written, and
 * again after every change.
 */
@Entity
@Table(name = "solution_customer_deployment")
public class CustomerDeployment {

	public static final String IN_REVIEW = "in_review";

	public static final String APPROVED = "approved";

	public static final String REJECTED = "rejected";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID solutionId;

	@Column(nullable = false)
	private String title;

	@Column(nullable = false)
	private String customer;

	@Column(nullable = false)
	private String problem;

	@Column(nullable = false)
	private String delivered;

	@Column(nullable = false)
	private String stage;

	private @Nullable String channels;

	private @Nullable String languages;

	private @Nullable String period;

	private @Nullable String result;

	@Column(nullable = false)
	private String status = IN_REVIEW;

	private @Nullable String decisionReason;

	private @Nullable String decisionMessage;

	private @Nullable Instant decidedAt;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected CustomerDeployment() {
	}

	@SuppressWarnings("NullAway.Init")
	public CustomerDeployment(UUID id, UUID solutionId) {
		this.id = id;
		this.solutionId = solutionId;
	}

	/** Takes what its owners wrote and sends it to review, whatever was decided before. */
	public void describe(String title, String customer, String problem, String delivered, String stage,
			@Nullable String channels, @Nullable String languages, @Nullable String period, @Nullable String result) {
		this.title = title;
		this.customer = customer;
		this.problem = problem;
		this.delivered = delivered;
		this.stage = stage;
		this.channels = channels;
		this.languages = languages;
		this.period = period;
		this.result = result;
		status = IN_REVIEW;
		decisionReason = null;
		decisionMessage = null;
		decidedAt = null;
	}

	public void approve(Instant at) {
		status = APPROVED;
		decisionReason = null;
		decisionMessage = null;
		decidedAt = at;
	}

	public void reject(String reason, @Nullable String message, Instant at) {
		status = REJECTED;
		decisionReason = reason;
		decisionMessage = message;
		decidedAt = at;
	}

	public boolean isInReview() {
		return IN_REVIEW.equals(status);
	}

	public boolean isApproved() {
		return APPROVED.equals(status);
	}

	public UUID getId() {
		return id;
	}

	public UUID getSolutionId() {
		return solutionId;
	}

	public String getTitle() {
		return title;
	}

	public String getCustomer() {
		return customer;
	}

	public String getProblem() {
		return problem;
	}

	public String getDelivered() {
		return delivered;
	}

	public String getStage() {
		return stage;
	}

	public @Nullable String getChannels() {
		return channels;
	}

	public @Nullable String getLanguages() {
		return languages;
	}

	public @Nullable String getPeriod() {
		return period;
	}

	public @Nullable String getResult() {
		return result;
	}

	public String getStatus() {
		return status;
	}

	public @Nullable String getDecisionReason() {
		return decisionReason;
	}

	public @Nullable String getDecisionMessage() {
		return decisionMessage;
	}

	public @Nullable Instant getDecidedAt() {
		return decidedAt;
	}

	public long getVersion() {
		return version;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
