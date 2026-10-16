package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.jspecify.annotations.Nullable;

/** One thing a program's applications are judged on. A program's criteria are replaced whole. */
@Entity
@Table(name = "review_criterion")
public class ReviewCriterion {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID programId;

	@Column(nullable = false, updatable = false)
	private int position;

	@Column(nullable = false, updatable = false)
	private String name;

	@Column(updatable = false)
	private @Nullable String description;

	/** The points the highest level gives; null when the program's criteria are not worth points. */
	@Column(updatable = false)
	private @Nullable Integer maxPoints;

	@SuppressWarnings("NullAway.Init")
	protected ReviewCriterion() {
	}

	public ReviewCriterion(UUID id, UUID programId, int position, String name, @Nullable String description,
			@Nullable Integer maxPoints) {
		this.id = id;
		this.programId = programId;
		this.position = position;
		this.name = name;
		this.description = description;
		this.maxPoints = maxPoints;
	}

	public UUID getId() {
		return id;
	}

	public UUID getProgramId() {
		return programId;
	}

	public int getPosition() {
		return position;
	}

	public String getName() {
		return name;
	}

	public @Nullable String getDescription() {
		return description;
	}

	public @Nullable Integer getMaxPoints() {
		return maxPoints;
	}
}
