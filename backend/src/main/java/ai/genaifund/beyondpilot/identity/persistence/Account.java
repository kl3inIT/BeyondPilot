package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;

/** A person who signs in. The first successful sign-in with an address creates it ({@link AccountRepository}). */
@Entity
@Table(name = "identity_account")
public class Account {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private String email;

	private @Nullable String displayName;

	@Column(nullable = false)
	private AccountStatus status;

	@Column(nullable = false)
	private PlatformRole platformRole;

	private @Nullable Instant lastLoginAt;

	@Version
	private long version;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	@SuppressWarnings("NullAway.Init")
	protected Account() {
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public @Nullable String getDisplayName() {
		return displayName;
	}

	public PlatformRole getPlatformRole() {
		return platformRole;
	}

	public boolean isDisabled() {
		return status == AccountStatus.DISABLED;
	}

	public void recordSignIn(Instant at) {
		lastLoginAt = at;
	}

	public void makeOperator() {
		platformRole = PlatformRole.OPERATOR;
	}

	/** Keeps the name a person already has; a provider's name only fills an empty one. */
	public void nameIfUnnamed(@Nullable String name) {
		if (displayName == null && name != null && !name.isBlank()) {
			displayName = name.strip();
		}
	}
}
