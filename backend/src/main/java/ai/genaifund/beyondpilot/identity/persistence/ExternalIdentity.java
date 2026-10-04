package ai.genaifund.beyondpilot.identity.persistence;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** An account's identity at an external provider: the provider and the subject it issued, stored exactly as issued. */
@Entity
@Table(name = "identity_external_identity")
public class ExternalIdentity {

	public static final String GOOGLE = "google";

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID accountId;

	@Column(nullable = false, updatable = false)
	private String provider;

	@Column(nullable = false, updatable = false)
	private String subject;

	@SuppressWarnings("NullAway.Init")
	protected ExternalIdentity() {
	}

	public UUID getAccountId() {
		return accountId;
	}
}
