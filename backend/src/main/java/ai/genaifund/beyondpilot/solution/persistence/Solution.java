package ai.genaifund.beyondpilot.solution.persistence;

import java.time.Instant;
import java.util.ArrayList;
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

	public static final String IN_REVIEW = "in_review";

	/** GenAI Fund sent a solution that waited for review back to its owners, with what to change. */
	public static final String NEEDS_CHANGES = "needs_changes";

	public static final String APPROVED = "approved";

	/** GenAI Fund refused the solution for good; its owners cannot send it again. */
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

	/** The company's v1 product and market statements, distinct from operator backing and reviewed deployments. */
	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] productNames = {};

	private @Nullable String coreTechnology;

	private @Nullable String infrastructureUsed;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] segmentFocus = {};

	private @Nullable String notablePayingCustomers;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] useCaseIndustries = {};

	private @Nullable String useCaseDescriptions;

	private @Nullable String monetizationModel;

	private @Nullable String companyFundingStatus;

	private @Nullable String companyFundingRaised;

	private @Nullable String competitors;

	private @Nullable String channels;

	private @Nullable String backedBy;

	private @Nullable String program;

	private @Nullable String funding;

	private @Nullable Instant backingUpdatedAt;

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

	private @Nullable UUID logoFileId;

	private @Nullable UUID coverFileId;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "uuid[]")
	private UUID[] imageFileIds = {};

	@Column(nullable = false)
	private String status = DRAFT;

	private @Nullable String decisionReason;

	private @Nullable String decisionMessage;

	private @Nullable Instant decidedAt;

	private @Nullable Instant submittedAt;

	private @Nullable UUID submittedByAccountId;

	private @Nullable String suspensionReason;

	private @Nullable String suspensionMessage;

	private @Nullable Instant suspendedAt;

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
			@Nullable String channels, @Nullable String bestCustomerProfile) {
		this.channels = channels;
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

	/** The stored images it shows: its logo, its cover and those under the cover, in the order they are shown. */
	public void picture(@Nullable UUID logoFileId, @Nullable UUID coverFileId, List<UUID> imageFileIds) {
		this.logoFileId = logoFileId;
		this.coverFileId = coverFileId;
		this.imageFileIds = imageFileIds.toArray(UUID[]::new);
	}

	/**
	 * What GenAI Fund says of the solution beside its owners' words: who backs its company, the programme it was
	 * selected for and its funding. Only operators write it.
	 */
	public void back(@Nullable String backedBy, @Nullable String program, @Nullable String funding, Instant at) {
		this.backedBy = backedBy;
		this.program = program;
		this.funding = funding;
		this.backingUpdatedAt = at;
	}

	public void list(boolean listed) {
		this.listed = listed;
	}

	/** Sends the solution for review; a send back it answers is cleared, as a refusal only ever ends a review. */
	public void submit(Instant at, UUID byAccountId) {
		status = IN_REVIEW;
		decisionReason = null;
		decisionMessage = null;
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

	/** Sends a solution that waits for review back to its owners with what to change; there is no reason code. */
	public void sendBack(String message, Instant at) {
		status = NEEDS_CHANGES;
		decisionReason = null;
		decisionMessage = message;
		decidedAt = at;
	}

	/**
	 * Takes an approved solution out of the directory and matching. Its review stays approved, so restoring needs no
	 * new review; while it is down {@link #isApproved()} is false.
	 */
	public void takeDown(String reason, @Nullable String message, Instant at) {
		suspensionReason = reason;
		suspensionMessage = message;
		suspendedAt = at;
	}

	/** Puts a solution taken down back; the reason it was taken down stays readable on the record. */
	public void restore() {
		suspendedAt = null;
	}

	/**
	 * What a solution needs before GenAI Fund reviews it: a summary, a maturity, a focus area, an industry, a logo
	 * and a cover.
	 */
	public boolean isComplete() {
		return missing().isEmpty();
	}

	/** What a review needs and the solution lacks, by the name of each in the API, in the order of the editor. */
	public List<String> missing() {
		List<String> missing = new ArrayList<>();
		if (summary == null) {
			missing.add("summary");
		}
		if (maturity == null) {
			missing.add("maturity");
		}
		if (industries.length == 0) {
			missing.add("industries");
		}
		if (focusAreas.length == 0) {
			missing.add("focusAreas");
		}
		if (logoFileId == null) {
			missing.add("logo");
		}
		if (coverFileId == null) {
			missing.add("cover");
		}
		return List.copyOf(missing);
	}

	public boolean isDraft() {
		return DRAFT.equals(status);
	}

	public boolean isInReview() {
		return IN_REVIEW.equals(status);
	}

	public boolean isNeedsChanges() {
		return NEEDS_CHANGES.equals(status);
	}

	/** Approved by GenAI Fund and not taken down: what puts it in the directory once listed, and in matching. */
	public boolean isApproved() {
		return APPROVED.equals(status) && suspendedAt == null;
	}

	public boolean isTakenDown() {
		return suspendedAt != null;
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

	public List<String> getProductNames() {
		return List.of(productNames);
	}

	public @Nullable String getCoreTechnology() {
		return coreTechnology;
	}

	public @Nullable String getInfrastructureUsed() {
		return infrastructureUsed;
	}

	public List<String> getSegmentFocus() {
		return List.of(segmentFocus);
	}

	public @Nullable String getNotablePayingCustomers() {
		return notablePayingCustomers;
	}

	public List<String> getUseCaseIndustries() {
		return List.of(useCaseIndustries);
	}

	public @Nullable String getUseCaseDescriptions() {
		return useCaseDescriptions;
	}

	public @Nullable String getMonetizationModel() {
		return monetizationModel;
	}

	public @Nullable String getCompanyFundingStatus() {
		return companyFundingStatus;
	}

	public @Nullable String getCompanyFundingRaised() {
		return companyFundingRaised;
	}

	public @Nullable String getCompetitors() {
		return competitors;
	}

	public @Nullable String getChannels() {
		return channels;
	}

	public @Nullable String getBackedBy() {
		return backedBy;
	}

	public @Nullable String getProgram() {
		return program;
	}

	public @Nullable String getFunding() {
		return funding;
	}

	public @Nullable Instant getBackingUpdatedAt() {
		return backingUpdatedAt;
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

	public @Nullable UUID getLogoFileId() {
		return logoFileId;
	}

	public @Nullable UUID getCoverFileId() {
		return coverFileId;
	}

	public List<UUID> getImageFileIds() {
		return List.of(imageFileIds);
	}

	/** Every stored image it names: the logo, the cover and those under the cover. */
	public List<UUID> pictures() {
		List<UUID> pictures = new ArrayList<>(List.of(imageFileIds));
		if (coverFileId != null) {
			pictures.addFirst(coverFileId);
		}
		if (logoFileId != null) {
			pictures.addFirst(logoFileId);
		}
		return List.copyOf(pictures);
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

	public @Nullable String getSuspensionReason() {
		return suspensionReason;
	}

	public @Nullable String getSuspensionMessage() {
		return suspensionMessage;
	}

	public @Nullable Instant getSuspendedAt() {
		return suspendedAt;
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
