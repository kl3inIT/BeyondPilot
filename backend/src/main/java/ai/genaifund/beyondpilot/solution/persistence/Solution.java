package ai.genaifund.beyondpilot.solution.persistence;

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
 * One AI solution of an organization. Its codes are the lowercase values of the API and of the database; the request
 * records and the constraints of the table keep them to the known ones.
 */
@Entity
@Table(name = "solution")
public class Solution {

	public static final String DRAFT = "draft";

	public static final String SUBMITTED = "submitted";

	public static final String APPROVED = "approved";

	public static final String REJECTED = "rejected";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column(nullable = false, updatable = false)
	private String slug;

	@Column(nullable = false)
	private String name;

	private @Nullable String summary;

	private @Nullable String problemsSolved;

	private @Nullable String valueProposition;

	private @Nullable String traction;

	private @Nullable String bestCustomerProfile;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] builtWith = {};

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] languages = {};

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] focusAreas = {};

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] industries = {};

	private @Nullable String maturity;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] deployment = {};

	private @Nullable String website;

	private @Nullable String demoUrl;

	private @Nullable UUID deckFileId;

	private @Nullable String deckFileName;

	private @Nullable Long deckSizeBytes;

	private @Nullable Instant deckAttachedAt;

	@Column(nullable = false)
	private String status = DRAFT;

	private @Nullable String decisionReason;

	private @Nullable String decisionMessage;

	private @Nullable Instant decidedAt;

	private @Nullable Instant submittedAt;

	private @Nullable UUID submittedByAccountId;

	@Column(nullable = false)
	private boolean listed = true;

	@Column(nullable = false, updatable = false)
	private UUID createdByAccountId;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected Solution() {
	}

	/** A draft with what a solution cannot do without; everything else is filled in afterwards. */
	@SuppressWarnings("NullAway.Init")
	public Solution(UUID id, UUID organizationId, String slug, String name, UUID createdByAccountId) {
		this.id = id;
		this.organizationId = organizationId;
		this.slug = slug;
		this.name = name;
		this.createdByAccountId = createdByAccountId;
	}

	/** What the solution is: its name, what it does, how far it has come and what it is built with. */
	public void describe(String name, @Nullable String summary, @Nullable String problemsSolved,
			@Nullable String valueProposition, @Nullable String maturity, @Nullable String traction,
			List<String> builtWith) {
		this.name = name;
		this.summary = summary;
		this.problemsSolved = problemsSolved;
		this.valueProposition = valueProposition;
		this.maturity = maturity;
		this.traction = traction;
		this.builtWith = builtWith.toArray(String[]::new);
	}

	/** Who should find the solution and where it can run. */
	public void fit(List<String> industries, List<String> focusAreas, List<String> languages, List<String> deployment,
			@Nullable String bestCustomerProfile) {
		this.industries = industries.toArray(String[]::new);
		this.focusAreas = focusAreas.toArray(String[]::new);
		this.languages = languages.toArray(String[]::new);
		this.deployment = deployment.toArray(String[]::new);
		this.bestCustomerProfile = bestCustomerProfile;
	}

	/** Where a visitor reads or sees more of the solution. */
	public void link(@Nullable String website, @Nullable String demoUrl) {
		this.website = website;
		this.demoUrl = demoUrl;
	}

	/** Names a stored file as the deck, with the name and the size it was uploaded under. */
	public void attachDeck(UUID fileId, String fileName, long sizeBytes, Instant at) {
		deckFileId = fileId;
		deckFileName = fileName;
		deckSizeBytes = sizeBytes;
		deckAttachedAt = at;
	}

	public void removeDeck() {
		deckFileId = null;
		deckFileName = null;
		deckSizeBytes = null;
		deckAttachedAt = null;
	}

	public void list(boolean listed) {
		this.listed = listed;
	}

	public void submit(Instant at, UUID byAccountId) {
		status = SUBMITTED;
		submittedAt = at;
		submittedByAccountId = byAccountId;
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

	/** What a solution needs before GenAI Fund reviews it: a summary, a maturity, a focus area and an industry. */
	public boolean isComplete() {
		return summary != null && maturity != null && focusAreas.length > 0 && industries.length > 0;
	}

	public boolean isDraft() {
		return DRAFT.equals(status);
	}

	public boolean isSubmitted() {
		return SUBMITTED.equals(status);
	}

	public boolean isApproved() {
		return APPROVED.equals(status);
	}

	public boolean isRejected() {
		return REJECTED.equals(status);
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public String getSlug() {
		return slug;
	}

	public String getName() {
		return name;
	}

	public @Nullable String getSummary() {
		return summary;
	}

	public @Nullable String getProblemsSolved() {
		return problemsSolved;
	}

	public @Nullable String getValueProposition() {
		return valueProposition;
	}

	public List<String> getFocusAreas() {
		return List.of(focusAreas);
	}

	public List<String> getIndustries() {
		return List.of(industries);
	}

	public @Nullable String getMaturity() {
		return maturity;
	}

	public List<String> getDeployment() {
		return List.of(deployment);
	}

	public @Nullable String getWebsite() {
		return website;
	}

	public @Nullable String getDemoUrl() {
		return demoUrl;
	}

	public @Nullable String getTraction() {
		return traction;
	}

	public @Nullable String getBestCustomerProfile() {
		return bestCustomerProfile;
	}

	public List<String> getBuiltWith() {
		return List.of(builtWith);
	}

	public List<String> getLanguages() {
		return List.of(languages);
	}

	public @Nullable UUID getDeckFileId() {
		return deckFileId;
	}

	public @Nullable String getDeckFileName() {
		return deckFileName;
	}

	public @Nullable Long getDeckSizeBytes() {
		return deckSizeBytes;
	}

	public @Nullable Instant getDeckAttachedAt() {
		return deckAttachedAt;
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

	public @Nullable Instant getSubmittedAt() {
		return submittedAt;
	}

	public @Nullable UUID getSubmittedByAccountId() {
		return submittedByAccountId;
	}

	public boolean isListed() {
		return listed;
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
