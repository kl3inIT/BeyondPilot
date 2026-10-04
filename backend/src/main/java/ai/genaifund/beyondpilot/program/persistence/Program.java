package ai.genaifund.beyondpilot.program.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;

/** One program GenAI Fund runs. It starts as a draft that only operators see. */
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
