package ai.genaifund.beyondpilot.organization.persistence;

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
 * One company, team or builder. Its codes (type, team size, status) are the lowercase values of the API and of
 * the database; the request records and the constraints of the table keep them to the known ones.
 */
@Entity
@Table(name = "organization")
public class Organization {

	public static final String PENDING = "pending";

	public static final String APPROVED = "approved";

	public static final String REJECTED = "rejected";

	public static final String SUSPENDED = "suspended";

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

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] industries = {};

	private @Nullable String description;

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
	 * @param status {@link #PENDING} for one a person creates, {@link #APPROVED} for one an operator creates
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
		this.industries = industries.toArray(String[]::new);
		this.description = description;
		this.foundedYear = foundedYear;
		this.logoFileId = logoFileId;
	}

	/**
	 * The domain an operator verified as the organization's; null when none is. Without one no address joins at once.
	 */
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

	/** A refused organization that its owner corrected waits for review again; the last decision stays readable. */
	public void resubmit() {
		status = PENDING;
	}

	/** Takes an approved organization down; what it was approved with stays, so restoring needs no new review. */
	public void suspend(String reason, @Nullable String message, Instant at) {
		status = SUSPENDED;
		suspensionReason = reason;
		suspensionMessage = message;
		suspendedAt = at;
	}

	/** Returns a taken-down organization to approved; the reason it was taken down stays readable on the record. */
	public void restore() {
		status = APPROVED;
	}

	public boolean isSuspended() {
		return SUSPENDED.equals(status);
	}

	public boolean isApproved() {
		return APPROVED.equals(status);
	}

	public boolean isRejected() {
		return REJECTED.equals(status);
	}

	public boolean isPending() {
		return PENDING.equals(status);
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
