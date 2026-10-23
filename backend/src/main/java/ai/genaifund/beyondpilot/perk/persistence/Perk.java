package ai.genaifund.beyondpilot.perk.persistence;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

/**
 * What an organization gives to members of BeyondPilot: its words, who may get it, how, between which dates and how
 * many times. Its steps and a request's questions are JSON the application service writes and reads whole.
 */
@Entity
@Table(name = "perk")
public class Perk {

	public static final String DRAFT = "draft";

	public static final String PUBLISHED = "published";

	public static final String ARCHIVED = "archived";

	public static final String EVERYONE = "everyone";

	public static final String MEMBERS = "members";

	public static final String APPLICANTS = "applicants";

	public static final String SHORTLISTED = "shortlisted";

	public static final String LINK = "link";

	public static final String CODE = "code";

	public static final String CODES = "codes";

	public static final String REQUEST = "request";

	@Id
	private UUID id;

	/** The organization that gives it; it moves only with a merge. */
	@Column(nullable = false)
	private UUID organizationId;

	@Column(nullable = false, updatable = false)
	private String slug;

	@Column(nullable = false)
	private String title;

	private @Nullable String value;

	private @Nullable String summary;

	private @Nullable String about;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String steps = "[]";

	private @Nullable String terms;

	private @Nullable String termsUrl;

	@Column(nullable = false)
	private String audience = EVERYONE;

	private @Nullable UUID programId;

	@Column(nullable = false)
	private String way = LINK;

	/** The partner's page for a link perk. */
	private @Nullable String url;

	/** The code GenAI Fund holds for a code perk's audience. */
	private @Nullable String code;

	/** Where a code is redeemed. */
	private @Nullable String redeemUrl;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private String questions = "[]";

	@Column(nullable = false)
	private boolean requireApproval = true;

	@Column(nullable = false)
	private boolean perPerson;

	private @Nullable Integer places;

	private @Nullable Instant startsAt;

	private @Nullable Instant endsAt;

	/** Whether GenAI Fund arranged it with the organization, which its card marks; only an operator says so. */
	@Column(name = "from_genai_fund", nullable = false)
	private boolean fromGenAiFund;

	@Column(nullable = false)
	private String state = DRAFT;

	private @Nullable Instant publishedAt;

	/** The solutions of its organization it goes with. */
	@ElementCollection
	@CollectionTable(name = "perk_solution", joinColumns = @JoinColumn(name = "perk_id"))
	@Column(name = "solution_id")
	private Set<UUID> solutionIds = new LinkedHashSet<>();

	/** The programs whose page an operator added it to, beside the perks for their teams. */
	@ElementCollection
	@CollectionTable(name = "perk_program", joinColumns = @JoinColumn(name = "perk_id"))
	@Column(name = "program_id")
	private Set<UUID> shownOnProgramIds = new LinkedHashSet<>();

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected Perk() {
	}

	@SuppressWarnings("NullAway.Init")
	public Perk(UUID id, UUID organizationId, String slug, String title) {
		this.id = id;
		this.organizationId = organizationId;
		this.slug = slug;
		this.title = title;
	}

	/** Keeps what its form holds; the steps and questions are JSON arrays. */
	public void describe(Description description) {
		this.title = description.title();
		this.value = description.value();
		this.summary = description.summary();
		this.about = description.about();
		this.steps = description.steps();
		this.terms = description.terms();
		this.termsUrl = description.termsUrl();
		this.audience = description.audience();
		this.programId = description.programId();
		this.way = description.way();
		this.url = description.url();
		this.code = description.code();
		this.redeemUrl = description.redeemUrl();
		this.questions = description.questions();
		this.requireApproval = description.requireApproval();
		this.perPerson = description.perPerson();
		this.places = description.places();
		this.startsAt = description.startsAt();
		this.endsAt = description.endsAt();
	}

	/** What a perk's form holds, as stored. */
	public record Description(String title, @Nullable String value, @Nullable String summary, @Nullable String about,
			String steps, @Nullable String terms, @Nullable String termsUrl, String audience, @Nullable UUID programId,
			String way, @Nullable String url, @Nullable String code, @Nullable String redeemUrl, String questions,
			boolean requireApproval, boolean perPerson, @Nullable Integer places, @Nullable Instant startsAt,
			@Nullable Instant endsAt) {
	}

	/** Says whether GenAI Fund arranged it. */
	public void arrangedByGenAiFund(boolean arranged) {
		this.fromGenAiFund = arranged;
	}

	/** Goes with these solutions; the same ones leave it untouched. */
	public void goWith(Collection<UUID> solutionIds) {
		if (!this.solutionIds.equals(Set.copyOf(solutionIds))) {
			this.solutionIds.clear();
			this.solutionIds.addAll(solutionIds);
		}
	}

	/** Shows on these programs' pages beside the perks for their teams. */
	public void showOn(Collection<UUID> programIds) {
		if (!this.shownOnProgramIds.equals(Set.copyOf(programIds))) {
			this.shownOnProgramIds.clear();
			this.shownOnProgramIds.addAll(programIds);
		}
	}

	/** Publishes it, or publishes it again from the archive; answers whether that changed it. */
	public boolean publish() {
		if (PUBLISHED.equals(state)) {
			return false;
		}
		this.state = PUBLISHED;
		if (publishedAt == null) {
			this.publishedAt = Instant.now();
		}
		return true;
	}

	/** Takes it off the site, keeping it and what teams got; answers whether that changed it. */
	public boolean archive() {
		if (ARCHIVED.equals(state)) {
			return false;
		}
		this.state = ARCHIVED;
		return true;
	}

	/** Whether it is published and between its dates at this moment. */
	public boolean isOpen(Instant now) {
		return PUBLISHED.equals(state) && (startsAt == null || !startsAt.isAfter(now))
				&& (endsAt == null || endsAt.isAfter(now));
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

	public String getTitle() {
		return title;
	}

	public @Nullable String getValue() {
		return value;
	}

	public @Nullable String getSummary() {
		return summary;
	}

	public @Nullable String getAbout() {
		return about;
	}

	public String getSteps() {
		return steps;
	}

	public @Nullable String getTerms() {
		return terms;
	}

	public @Nullable String getTermsUrl() {
		return termsUrl;
	}

	public String getAudience() {
		return audience;
	}

	public @Nullable UUID getProgramId() {
		return programId;
	}

	public String getWay() {
		return way;
	}

	public @Nullable String getUrl() {
		return url;
	}

	public @Nullable String getCode() {
		return code;
	}

	public @Nullable String getRedeemUrl() {
		return redeemUrl;
	}

	public String getQuestions() {
		return questions;
	}

	public boolean isRequireApproval() {
		return requireApproval;
	}

	public boolean isPerPerson() {
		return perPerson;
	}

	public @Nullable Integer getPlaces() {
		return places;
	}

	public @Nullable Instant getStartsAt() {
		return startsAt;
	}

	public @Nullable Instant getEndsAt() {
		return endsAt;
	}

	public boolean isFromGenAiFund() {
		return fromGenAiFund;
	}

	public String getState() {
		return state;
	}

	public @Nullable Instant getPublishedAt() {
		return publishedAt;
	}

	public Set<UUID> getSolutionIds() {
		return Set.copyOf(solutionIds);
	}

	public Set<UUID> getShownOnProgramIds() {
		return Set.copyOf(shownOnProgramIds);
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
