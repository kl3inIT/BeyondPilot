package ai.genaifund.beyondpilot.program.persistence;

import java.time.Instant;
import java.time.LocalDate;
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
import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;

/**
 * One program GenAI Fund runs, with its key dates and its events. It starts as a draft that only operators see.
 */
@Entity
@Table(name = "program")
public class Program {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false)
	private String slug;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private ProgramType type;

	private @Nullable String partnerName;

	private @Nullable String summary;

	private @Nullable String about;

	private @Nullable LocalDate startsOn;

	private @Nullable LocalDate endsOn;

	@Column(nullable = false)
	private ProgramStatus status = ProgramStatus.DRAFT;

	@Column(nullable = false)
	private PageKind pageKind = PageKind.STANDARD;

	private @Nullable String externalUrl;

	private @Nullable Instant publishedAt;

	private @Nullable UUID coverFileId;

	private @Nullable Instant applicationsOpenAt;

	private @Nullable Instant applicationsCloseAt;

	private @Nullable Integer shortlistSize;

	private @Nullable LocalDate outcomesDueOn;

	@Column(nullable = false)
	private boolean allowUpdatesUntilClose = true;

	@ElementCollection
	@CollectionTable(name = "program_milestone", joinColumns = @JoinColumn(name = "program_id"))
	@OrderColumn(name = "position")
	private List<ProgramMilestone> milestones = new ArrayList<>();

	@ElementCollection
	@CollectionTable(name = "program_event", joinColumns = @JoinColumn(name = "program_id"))
	@OrderColumn(name = "position")
	private List<ProgramEvent> events = new ArrayList<>();

	@ElementCollection
	@CollectionTable(name = "program_question", joinColumns = @JoinColumn(name = "program_id"))
	@OrderColumn(name = "position")
	private List<ProgramQuestion> questions = new ArrayList<>();

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected Program() {
	}

	/** A draft with what a program cannot do without; everything else is filled in afterwards. */
	@SuppressWarnings("NullAway.Init")
	public Program(String slug, String name, ProgramType type) {
		this.slug = slug;
		this.name = name;
		this.type = type;
	}

	public void describe(String name, ProgramType type, @Nullable String partnerName, @Nullable String summary,
			@Nullable String about) {
		this.name = name;
		this.type = type;
		this.partnerName = partnerName;
		this.summary = summary;
		this.about = about;
	}

	public void moveTo(String slug) {
		this.slug = slug;
	}

	public void runBetween(@Nullable LocalDate startsOn, @Nullable LocalDate endsOn) {
		this.startsOn = startsOn;
		this.endsOn = endsOn;
	}

	public void showAs(PageKind pageKind, @Nullable String externalUrl) {
		this.pageKind = pageKind;
		this.externalUrl = externalUrl;
	}

	public void coverWith(@Nullable UUID coverFileId) {
		this.coverFileId = coverFileId;
	}

	public void takeApplications(Instant opensAt, Instant closesAt, @Nullable Integer shortlistSize,
			@Nullable LocalDate outcomesDueOn, boolean allowUpdatesUntilClose) {
		this.applicationsOpenAt = opensAt;
		this.applicationsCloseAt = closesAt;
		this.shortlistSize = shortlistSize;
		this.outcomesDueOn = outcomesDueOn;
		this.allowUpdatesUntilClose = allowUpdatesUntilClose;
	}

	public void takeNoApplications() {
		this.applicationsOpenAt = null;
		this.applicationsCloseAt = null;
		this.shortlistSize = null;
		this.outcomesDueOn = null;
		this.allowUpdatesUntilClose = true;
	}

	/** The lists are replaced as given; an unchanged list writes nothing. */
	public void schedule(List<ProgramMilestone> milestones, List<ProgramEvent> events) {
		if (!this.milestones.equals(milestones)) {
			this.milestones.clear();
			this.milestones.addAll(milestones);
		}
		if (!this.events.equals(events)) {
			this.events.clear();
			this.events.addAll(events);
		}
	}

	/** The questions are replaced as given, in that order. */
	public void ask(List<ProgramQuestion> questions) {
		this.questions.clear();
		this.questions.addAll(questions);
	}

	public List<ProgramQuestion> getQuestions() {
		return List.copyOf(questions);
	}

	/**
	 * Puts the program on the public site; the first time also fixes its address.
	 * @return whether this changed anything
	 */
	public boolean publish(Instant at) {
		if (status == ProgramStatus.PUBLISHED) {
			return false;
		}
		status = ProgramStatus.PUBLISHED;
		if (publishedAt == null) {
			publishedAt = at;
		}
		return true;
	}

	/**
	 * Takes the program off the public site. Everything it holds stays, and so does its address.
	 * @return whether this changed anything
	 */
	public boolean unpublish() {
		if (status == ProgramStatus.DRAFT) {
			return false;
		}
		status = ProgramStatus.DRAFT;
		return true;
	}

	/** The address is fixed from the first publication on. */
	public boolean hasBeenPublished() {
		return publishedAt != null;
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

	public ProgramType getType() {
		return type;
	}

	public @Nullable String getPartnerName() {
		return partnerName;
	}

	public @Nullable String getSummary() {
		return summary;
	}

	public @Nullable String getAbout() {
		return about;
	}

	public @Nullable LocalDate getStartsOn() {
		return startsOn;
	}

	public @Nullable LocalDate getEndsOn() {
		return endsOn;
	}

	public ProgramStatus getStatus() {
		return status;
	}

	public PageKind getPageKind() {
		return pageKind;
	}

	public @Nullable String getExternalUrl() {
		return externalUrl;
	}

	public @Nullable UUID getCoverFileId() {
		return coverFileId;
	}

	public @Nullable Instant getApplicationsOpenAt() {
		return applicationsOpenAt;
	}

	public @Nullable Instant getApplicationsCloseAt() {
		return applicationsCloseAt;
	}

	public @Nullable Integer getShortlistSize() {
		return shortlistSize;
	}

	public @Nullable LocalDate getOutcomesDueOn() {
		return outcomesDueOn;
	}

	public boolean isAllowUpdatesUntilClose() {
		return allowUpdatesUntilClose;
	}

	public List<ProgramMilestone> getMilestones() {
		return List.copyOf(milestones);
	}

	public List<ProgramEvent> getEvents() {
		return List.copyOf(events);
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
