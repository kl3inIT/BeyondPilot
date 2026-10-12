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
 * An offer solutions come with, such as cloud credits: the line that names it and the page where it is claimed.
 * GenAI Fund keeps a list every solution chooses from; an organization writes offers of its own, which only its
 * solutions come with.
 */
@Entity
@Table(name = "offer")
public class Offer {

	@Id
	private UUID id;

	/** The organization that wrote it; null for an offer of GenAI Fund's list. */
	@Column(updatable = false)
	private @Nullable UUID organizationId;

	@Column(nullable = false)
	private String title;

	@Column(nullable = false)
	private String url;

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
	public Offer(UUID id, @Nullable UUID organizationId, String title, String url) {
		this.id = id;
		this.organizationId = organizationId;
		this.title = title;
		this.url = url;
	}

	public void describe(String title, String url) {
		this.title = title;
		this.url = url;
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

	public @Nullable UUID getOrganizationId() {
		return organizationId;
	}

	/** Whether a solution of this organization may come with it: GenAI Fund's, or the organization's own. */
	public boolean isFor(UUID organization) {
		return organizationId == null || organizationId.equals(organization);
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
