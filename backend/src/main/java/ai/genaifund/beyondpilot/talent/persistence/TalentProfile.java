package ai.genaifund.beyondpilot.talent.persistence;

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
 * The talent profile of one person. Its codes are the lowercase values of the API and of the database; the request
 * records and the constraints of the table keep them to the known ones.
 */
@Entity
@Table(name = "talent_profile")
public class TalentProfile {

	public static final String DRAFT = "draft";

	public static final String SUBMITTED = "submitted";

	public static final String APPROVED = "approved";

	public static final String REJECTED = "rejected";

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID accountId;

	@Column(nullable = false, updatable = false)
	private String slug;

	@Column(nullable = false)
	private String name;

	private @Nullable String headline;

	private @Nullable String bio;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] roles = {};

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] skills = {};

	private @Nullable String country;

	private @Nullable String availability;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "text[]")
	private String[] engagement = {};

	private @Nullable String rateBand;

	private @Nullable String website;

	@Column(nullable = false)
	private String status = DRAFT;

	private @Nullable String decisionReason;

	private @Nullable String decisionMessage;

	private @Nullable Instant decidedAt;

	private @Nullable Instant submittedAt;

	@Column(nullable = false)
	private boolean listed = true;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected TalentProfile() {
	}

	/** A draft with what a profile cannot do without; everything else is filled in by {@link #describe}. */
	@SuppressWarnings("NullAway.Init")
	public TalentProfile(UUID id, UUID accountId, String slug, String name) {
		this.id = id;
		this.accountId = accountId;
		this.slug = slug;
		this.name = name;
	}

	public void describe(String name, @Nullable String headline, @Nullable String bio, List<String> roles,
			List<String> skills, @Nullable String country, @Nullable String availability, List<String> engagement,
			@Nullable String rateBand, @Nullable String website) {
		this.name = name;
		this.headline = headline;
		this.bio = bio;
		this.roles = roles.toArray(String[]::new);
		this.skills = skills.toArray(String[]::new);
		this.country = country;
		this.availability = availability;
		this.engagement = engagement.toArray(String[]::new);
		this.rateBand = rateBand;
		this.website = website;
	}

	public void list(boolean listed) {
		this.listed = listed;
	}

	public void submit(Instant at) {
		status = SUBMITTED;
		submittedAt = at;
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

	/** What a profile needs before GenAI Fund reviews it: a headline, a bio, a role and a skill. */
	public boolean isComplete() {
		return headline != null && bio != null && roles.length > 0 && skills.length > 0;
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

	public UUID getAccountId() {
		return accountId;
	}

	public String getSlug() {
		return slug;
	}

	public String getName() {
		return name;
	}

	public @Nullable String getHeadline() {
		return headline;
	}

	public @Nullable String getBio() {
		return bio;
	}

	public List<String> getRoles() {
		return List.of(roles);
	}

	public List<String> getSkills() {
		return List.of(skills);
	}

	public @Nullable String getCountry() {
		return country;
	}

	public @Nullable String getAvailability() {
		return availability;
	}

	public List<String> getEngagement() {
		return List.of(engagement);
	}

	public @Nullable String getRateBand() {
		return rateBand;
	}

	public @Nullable String getWebsite() {
		return website;
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

	public boolean isListed() {
		return listed;
	}

	public long getVersion() {
		return version;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
