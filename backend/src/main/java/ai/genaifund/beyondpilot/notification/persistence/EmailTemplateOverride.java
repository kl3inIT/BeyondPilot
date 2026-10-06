package ai.genaifund.beyondpilot.notification.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** An operator's wording of one kind of email, in place of the default. */
@Entity
@Table(name = "email_template")
public class EmailTemplateOverride {

	@Id
	private String kind;

	@Column(nullable = false)
	private String subject;

	@Column(nullable = false)
	private String body;

	@Column(nullable = false)
	private UUID updatedBy;

	@Column(nullable = false)
	private String updatedByLabel;

	@Column(nullable = false)
	private Instant updatedAt;

	@Version
	private long version;

	protected EmailTemplateOverride() {
		this.kind = "";
		this.subject = "";
		this.body = "";
		this.updatedBy = new UUID(0, 0);
		this.updatedByLabel = "";
		this.updatedAt = Instant.EPOCH;
	}

	public String getKind() {
		return kind;
	}

	public String getSubject() {
		return subject;
	}

	public String getBody() {
		return body;
	}

	public UUID getUpdatedBy() {
		return updatedBy;
	}

	public String getUpdatedByLabel() {
		return updatedByLabel;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
