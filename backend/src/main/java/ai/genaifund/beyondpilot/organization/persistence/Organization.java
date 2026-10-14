package ai.genaifund.beyondpilot.organization.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.organization.Membership;

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
 * One company, team or builder. Its codes (type, team size, status) are the lowercase values of the API and of
 * the database; the request records and the constraints of the table keep them to the known ones.
 */
@Entity
@Table(name = "organization")
public class Organization {

	public static final String IN_REVIEW = "in_review";

	public static final String NEEDS_CHANGES = "needs_changes";

	public static final String APPROVED = "approved";

	public static final String REJECTED = "rejected";

	/** Merged into another organization by an operator: a record of where it went, which nobody changes. */
	public static final String MERGED = "merged";

	/** The type of a builder on their own: the organization stands for its one person, so nobody reviews it. */
	public static final String INDIVIDUAL = Membership.INDIVIDUAL;

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private String slug;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String type;

	private @Nullable String website;

	private @Nullable String country;

	private @Nullable String teamSize;
	private @Nullable String companySizeLabel;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] industries = {};

	private @Nullable String description;

	private @Nullable String teamBackground;

	private @Nullable Integer foundedYear;

	private @Nullable UUID logoFileId;

	private @Nullable String emailDomain;

	@Column(nullable = false)
	private boolean autoJoin;

	@Column(nullable = false)
	private String status;

	private @Nullable String decisionReason;

	private @Nullable String decisionMessage;

	private @Nullable Instant decidedAt;

	private @Nullable String suspensionReason;

	private @Nullable String suspensionMessage;

	private @Nullable Instant suspendedAt;

	private @Nullable UUID mergedIntoId;

	private @Nullable Instant mergedAt;

	private @Nullable UUID mergedByAccountId;

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
	protected Organization() {
	}

	/**
	 * @param status {@link #IN_REVIEW} for one a person creates, {@link #APPROVED} for one an operator creates
	 */
	@SuppressWarnings("NullAway.Init")
	public Organization(UUID id, String slug, String name, String type, String status,
			UUID createdByAccountId) {
		this.id = id;
		this.slug = slug;
		this.name = name;
		this.type = type;
		this.status = status;
		this.createdByAccountId = createdByAccountId;
	}

	public void describe(String name, String type, @Nullable String website,
			@Nullable String country, @Nullable String teamSize, List<String> industries,
			@Nullable String description, @Nullable Integer foundedYear, @Nullable UUID logoFileId) {
		this.name = name;
		this.type = type;
		this.website = website;
		this.country = country;
		this.teamSize = teamSize;
		this.companySizeLabel = null;
		this.industries = industries.toArray(String[]::new);
		this.description = description;
		this.foundedYear = foundedYear;
		this.logoFileId = logoFileId;
	}

	/** Retains legacy experience when explicitly supplied, including across a type change. */
	public void describeTeam(@Nullable String background) {
		this.teamBackground = background != null && !background.isBlank() ? background.strip() : null;
	}

	public @Nullable String getTeamBackground() {
		return teamBackground;
	}

	/** The domain an operator verified; null means no address joins at once. */
	public void verifyDomain(@Nullable String emailDomain) {
		this.emailDomain = emailDomain;
		if (emailDomain == null) {
			autoJoin = false;
		}
	}

	public void letDomainJoin(boolean autoJoin) {
		this.autoJoin = autoJoin;
	}

	public void approve(Instant at) {
		status = APPROVED;
		decisionReason = null;
		decisionMessage = null;
		decidedAt = at;
	}

	public void refuse(String reason, @Nullable String message, Instant at) {
		status = REJECTED;
		decisionReason = reason;
		decisionMessage = message;
		decidedAt = at;
	}

	/** Sends an organization back to its owners with what to change; they correct it and it waits for review again. */
	public void sendBack(String message, Instant at) {
		status = NEEDS_CHANGES;
		decisionReason = null;
		decisionMessage = message;
		decidedAt = at;
	}

	/** An organization sent back that its owner corrected waits for review again; the message stays readable. */
	public void resubmit() {
		status = IN_REVIEW;
	}

	/**
	 * Takes an approved organization down. Its review stays approved, so restoring needs no new review; while it is
	 * down {@link #isApproved()} is false.
	 */
	public void suspend(String reason, @Nullable String message, Instant at) {
		suspensionReason = reason;
		suspensionMessage = message;
		suspendedAt = at;
	}

	/** Puts a taken-down organization back; the reason it was taken down stays readable on the record. */
	public void restore() {
		suspendedAt = null;
	}

	/**
	 * Records that an operator merged this organization into another. It keeps no domain, so nobody is pointed to it
	 * any more.
	 */
	public void mergeInto(UUID organizationId, UUID operatorAccountId, Instant at) {
		status = MERGED;
		mergedIntoId = organizationId;
		mergedByAccountId = operatorAccountId;
		mergedAt = at;
		verifyDomain(null);
	}

	/**
	 * Settles the review after the profile changed from one type to another. A person on their own is approved
	 * without review, so one that waited is approved; an approved individual that becomes a team, a company or
	 * another organization waits for GenAI Fund's review like any it makes. A refused or taken-down organization
	 * keeps that decision whichever way its type goes, and a person on their own has no domain.
	 */
	public void settleTypeChange(String formerType, Instant at) {
		boolean wasIndividual = INDIVIDUAL.equals(formerType);
		if (isIndividual() && !wasIndividual) {
			if (isInReview() || isSentBack()) {
				approve(at);
			}
			verifyDomain(null);
		}
		else if (!isIndividual() && wasIndividual && isApproved()) {
			status = IN_REVIEW;
			decidedAt = null;
		}
	}

	/**
	 * Turns an individual into a team of the same person, which waits for GenAI Fund's review like any team.
	 */
	public void becomeTeam(String name, String teamSize, @Nullable String website) {
		this.name = name;
		this.type = "builder_team";
		this.teamSize = teamSize;
		this.website = website;
		this.status = IN_REVIEW;
		this.decidedAt = null;
	}

	/** A builder on their own: it is shown as its person, and it has no members, domain or page of its own. */
	public boolean isIndividual() {
		return INDIVIDUAL.equals(type);
	}

	public boolean isMerged() {
		return MERGED.equals(status);
	}

	public boolean isSuspended() {
		return suspendedAt != null;
	}

	/** Approved by GenAI Fund and not taken down: what lets it have members, solutions and use cases. */
	public boolean isApproved() {
		return APPROVED.equals(status) && suspendedAt == null;
	}

	public boolean isInReview() {
		return IN_REVIEW.equals(status);
	}

	/** Refused for good: nothing is decided about it any more, and it lets nobody in. */
	public boolean isRejected() {
		return REJECTED.equals(status);
	}

	public boolean isSentBack() {
		return NEEDS_CHANGES.equals(status);
	}

	public UUID getId() {
		return id;
	}

	public String getSlug() {
		return slug;
	}

	public String getName() {
		return name;
	}

	public String getType() {
		return type;
	}

	public @Nullable String getWebsite() {
		return website;
	}

	public @Nullable String getCountry() {
		return country;
	}

	public @Nullable String getTeamSize() {
		return teamSize;
	}

	public @Nullable String getCompanySizeLabel() {
		return companySizeLabel;
	}

	public List<String> getIndustries() {
		return List.of(industries);
	}

	public @Nullable String getDescription() {
		return description;
	}

	public @Nullable Integer getFoundedYear() {
		return foundedYear;
	}

	public @Nullable UUID getLogoFileId() {
		return logoFileId;
	}

	public @Nullable String getEmailDomain() {
		return emailDomain;
	}

	public boolean isAutoJoin() {
		return autoJoin;
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

	public @Nullable UUID getMergedIntoId() {
		return mergedIntoId;
	}

	public @Nullable Instant getMergedAt() {
		return mergedAt;
	}

	public @Nullable UUID getMergedByAccountId() {
		return mergedByAccountId;
	}

	public UUID getCreatedByAccountId() {
		return createdByAccountId;
	}

	public long getVersion() {
		return version;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
