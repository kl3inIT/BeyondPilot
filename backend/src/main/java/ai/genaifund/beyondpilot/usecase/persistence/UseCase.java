package ai.genaifund.beyondpilot.usecase.persistence;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

/**
 * One business problem an organization wants solved, with what a provider needs to answer it. Its codes (industry,
 * technologies, status) are the lowercase values of the API and of the database; the request record and the
 * constraints of the table keep them to the known ones. A draft may lack most of its content, since the members of the
 * organization write it step by step; a use case in review or published is complete.
 */
@Entity
@Table(name = "use_case")
public class UseCase {

	public static final String DRAFT = "draft";

	public static final String IN_REVIEW = "in_review";

	public static final String NEEDS_CHANGES = "needs_changes";

	public static final String PUBLISHED = "published";

	/** What a use case reads as once its close date has passed, whatever it was stored as. It is never stored. */
	public static final String CLOSED = "closed";

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	private @Nullable String title;

	private @Nullable String problemStatement;

	private @Nullable String industry;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] technologies = new String[0];

	private @Nullable String expectedOutcomes;

	private @Nullable String currentProcess;

	private @Nullable String currentSolutions;

	private @Nullable String targetUsers;

	private @Nullable String dataReadiness;

	private @Nullable String integrationRequirements;

	private @Nullable Integer budgetMin;

	private @Nullable Integer budgetMax;

	@Column(nullable = false)
	private boolean budgetToBeDetermined;

	@Column(nullable = false)
	private boolean budgetMembersOnly;

	private @Nullable Integer timelineMinWeeks;

	private @Nullable Integer timelineMaxWeeks;

	@Column(nullable = false)
	private boolean hideOrganizationName;

	@Column(nullable = false)
	private String status = DRAFT;

	private @Nullable Instant publishedAt;

	private @Nullable Instant closesAt;

	@Column(nullable = false, updatable = false)
	private UUID createdByAccountId;

	@Column(nullable = false)
	private UUID lastEditedByAccountId;

	private @Nullable Instant submittedAt;

	private @Nullable UUID submittedByAccountId;

	private @Nullable Instant reviewedAt;

	private @Nullable UUID reviewedByAccountId;

	private @Nullable String reviewNote;

	@ElementCollection
	@CollectionTable(name = "use_case_requirement", joinColumns = @JoinColumn(name = "use_case_id"))
	@OrderColumn(name = "position")
	private List<UseCaseRequirement> requirements = new ArrayList<>();

	@ElementCollection
	@CollectionTable(name = "use_case_attachment", joinColumns = @JoinColumn(name = "use_case_id"))
	@OrderColumn(name = "position")
	@Column(name = "file_id")
	private List<UUID> attachmentFileIds = new ArrayList<>();

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected UseCase() {
	}

	/** An empty draft for an organization, which its members fill in. */
	@SuppressWarnings("NullAway.Init")
	public UseCase(UUID organizationId, UUID createdByAccountId) {
		this.organizationId = organizationId;
		this.createdByAccountId = createdByAccountId;
		this.lastEditedByAccountId = createdByAccountId;
	}

	/** A draft an operator writes for an organization, with the date proposals stop. */
	public UseCase(UUID organizationId, UUID createdByAccountId, Instant closesAt) {
		this(organizationId, createdByAccountId);
		this.closesAt = closesAt;
	}

	public void describe(@Nullable String title, @Nullable String problemStatement, @Nullable String industry,
			List<String> technologies) {
		this.title = title;
		this.problemStatement = problemStatement;
		this.industry = industry;
		this.technologies = technologies.toArray(String[]::new);
	}

	public void explain(@Nullable String expectedOutcomes, @Nullable String currentProcess,
			@Nullable String currentSolutions, @Nullable String targetUsers) {
		this.expectedOutcomes = expectedOutcomes;
		this.currentProcess = currentProcess;
		this.currentSolutions = currentSolutions;
		this.targetUsers = targetUsers;
	}

	/** Names the files that explain the use case, in the order given. */
	public void attach(List<UUID> fileIds) {
		this.attachmentFileIds.clear();
		this.attachmentFileIds.addAll(fileIds);
	}

	public void specify(List<UseCaseRequirement> requirements, @Nullable String dataReadiness,
			@Nullable String integrationRequirements) {
		this.requirements.clear();
		this.requirements.addAll(requirements);
		this.dataReadiness = dataReadiness;
		this.integrationRequirements = integrationRequirements;
	}

	public void budget(@Nullable Integer min, @Nullable Integer max, boolean toBeDetermined, boolean membersOnly) {
		this.budgetMin = min;
		this.budgetMax = max;
		this.budgetToBeDetermined = toBeDetermined;
		this.budgetMembersOnly = membersOnly;
	}

	public void takeWeeks(@Nullable Integer min, @Nullable Integer max) {
		this.timelineMinWeeks = min;
		this.timelineMaxWeeks = max;
	}

	public void closeAt(@Nullable Instant closesAt) {
		this.closesAt = closesAt;
	}

	public void showCompanyName(boolean hide) {
		this.hideOrganizationName = hide;
	}

	/** Records who changed the use case last. */
	public void editedBy(UUID accountId) {
		this.lastEditedByAccountId = accountId;
	}

	public void publish(Instant now) {
		this.status = PUBLISHED;
		this.publishedAt = now;
	}

	/** Sends the use case to GenAI Fund: from then on it waits for a decision and its organization cannot edit it. */
	public void submit(UUID accountId, Instant now) {
		this.status = IN_REVIEW;
		this.submittedAt = now;
		this.submittedByAccountId = accountId;
		this.reviewNote = null;
	}

	/** GenAI Fund approves the use case: it is published at once. */
	public void approve(UUID accountId, Instant now) {
		this.status = PUBLISHED;
		this.publishedAt = now;
		this.reviewedAt = now;
		this.reviewedByAccountId = accountId;
		this.reviewNote = null;
	}

	/** GenAI Fund sends the use case back with what to change; its organization edits it and sends it again. */
	public void sendBack(UUID accountId, Instant now, String reason) {
		this.status = NEEDS_CHANGES;
		this.reviewedAt = now;
		this.reviewedByAccountId = accountId;
		this.reviewNote = reason;
	}

	/**
	 * Takes the use case back to a draft, out of review or out of the directory, so that its members can edit it. The
	 * reason GenAI Fund gave stays until the use case is sent again.
	 */
	public void backToDraft() {
		this.status = DRAFT;
		this.publishedAt = null;
	}

	/** The status at this moment: closed from the close date on, whatever was stored. */
	public String statusAt(Instant now) {
		return closesAt != null && !closesAt.isAfter(now) ? CLOSED : status;
	}

	/** Whether it holds everything a use case in review needs. */
	public boolean isComplete() {
		return title != null && problemStatement != null && industry != null && technologies.length > 0
				&& expectedOutcomes != null && currentProcess != null && targetUsers != null && dataReadiness != null
				&& integrationRequirements != null && !requirements.isEmpty() && timelineMinWeeks != null
				&& timelineMaxWeeks != null && closesAt != null
				&& (budgetToBeDetermined || (budgetMin != null && budgetMax != null));
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public @Nullable String getTitle() {
		return title;
	}

	public @Nullable String getProblemStatement() {
		return problemStatement;
	}

	public @Nullable String getIndustry() {
		return industry;
	}

	public List<String> getTechnologies() {
		return List.of(technologies);
	}

	public @Nullable String getExpectedOutcomes() {
		return expectedOutcomes;
	}

	public @Nullable String getCurrentProcess() {
		return currentProcess;
	}

	public @Nullable String getCurrentSolutions() {
		return currentSolutions;
	}

	public @Nullable String getTargetUsers() {
		return targetUsers;
	}

	public @Nullable String getDataReadiness() {
		return dataReadiness;
	}

	public @Nullable String getIntegrationRequirements() {
		return integrationRequirements;
	}

	public List<UseCaseRequirement> getRequirements() {
		return List.copyOf(requirements);
	}

	public List<UUID> getAttachmentFileIds() {
		return List.copyOf(attachmentFileIds);
	}

	public @Nullable Integer getBudgetMin() {
		return budgetMin;
	}

	public @Nullable Integer getBudgetMax() {
		return budgetMax;
	}

	public boolean isBudgetToBeDetermined() {
		return budgetToBeDetermined;
	}

	public boolean isBudgetMembersOnly() {
		return budgetMembersOnly;
	}

	public @Nullable Integer getTimelineMinWeeks() {
		return timelineMinWeeks;
	}

	public @Nullable Integer getTimelineMaxWeeks() {
		return timelineMaxWeeks;
	}

	public boolean isHideOrganizationName() {
		return hideOrganizationName;
	}

	public String getStatus() {
		return status;
	}

	public @Nullable Instant getPublishedAt() {
		return publishedAt;
	}

	public @Nullable Instant getClosesAt() {
		return closesAt;
	}

	public UUID getCreatedByAccountId() {
		return createdByAccountId;
	}

	public UUID getLastEditedByAccountId() {
		return lastEditedByAccountId;
	}

	public @Nullable Instant getSubmittedAt() {
		return submittedAt;
	}

	public @Nullable UUID getSubmittedByAccountId() {
		return submittedByAccountId;
	}

	public @Nullable Instant getReviewedAt() {
		return reviewedAt;
	}

	public @Nullable UUID getReviewedByAccountId() {
		return reviewedByAccountId;
	}

	public @Nullable String getReviewNote() {
		return reviewNote;
	}

	public long getVersion() {
		return version;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
