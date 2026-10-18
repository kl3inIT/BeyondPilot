package ai.genaifund.beyondpilot.solution.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;

/**
 * An offer solutions come with, such as cloud credits: the line that names it and the page where it is claimed. It
 * belongs to the organization that gives it, and only that organization's solutions come with it.
 */
@Entity
@Table(name = "offer")
public class Offer {

	@Id
	private UUID id;

	/** The organization that gives it. */
	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column(nullable = false)
	private String title;

	@Column(nullable = false)
	private String url;

	/** Whether GenAI Fund arranged it with the organization, which its card marks; only an operator says so. */
	@Column(name = "from_genai_fund", nullable = false)
	private boolean fromGenAiFund;

	/** When it was closed to new solutions; null while it is open. */
	private @Nullable Instant closedAt;

	@Version
	private long version;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected Offer() {
	}

	@SuppressWarnings("NullAway.Init")
	public Offer(UUID id, UUID organizationId, String title, String url, boolean fromGenAiFund) {
		this.id = id;
		this.organizationId = organizationId;
		this.title = title;
		this.url = url;
		this.fromGenAiFund = fromGenAiFund;
	}

	public void describe(String title, String url) {
		this.title = title;
		this.url = url;
	}

	/** Says whether GenAI Fund arranged it. */
	public void arrangedByGenAiFund(boolean arranged) {
		this.fromGenAiFund = arranged;
	}

	public boolean isFromGenAiFund() {
		return fromGenAiFund;
	}

	/** Closes it to new solutions, or opens it again; answers whether that changed it. */
	public boolean closeTo(boolean closed) {
		if (closed == isClosed()) {
			return false;
		}
		this.closedAt = closed ? Instant.now() : null;
		return true;
	}

	public boolean isClosed() {
		return closedAt != null;
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public String getTitle() {
		return title;
	}

	public String getUrl() {
		return url;
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
