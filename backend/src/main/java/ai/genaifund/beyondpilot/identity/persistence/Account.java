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

	private @Nullable String country;

	private @Nullable String phone;

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

	/** ISO 3166-1 alpha-2; null until the person says where they are. */
	public @Nullable String getCountry() {
		return country;
	}

	/** With its country code; null until the person gives a number. */
	public @Nullable String getPhone() {
		return phone;
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

	public boolean isOperator() {
		return platformRole == PlatformRole.OPERATOR;
	}

	/** The name a person is shown by: their name, or their address until they have one. */
	public String label() {
		return displayName != null ? displayName : email;
	}

	public void makeOperator() {
		platformRole = PlatformRole.OPERATOR;
	}

	public void withdrawOperator() {
		platformRole = PlatformRole.USER;
	}

	/** A disabled account cannot sign in, and its open sessions stop answering. Nothing it holds is removed. */
	public void disable() {
		status = AccountStatus.DISABLED;
	}

	public void enable() {
		status = AccountStatus.ACTIVE;
	}

	/** Replaces where the person is and their number; a blank part clears it. */
	public void reachAt(@Nullable String country, @Nullable String phone) {
		this.country = given(country);
		this.phone = given(phone);
	}

	/** Keeps what the account already holds; a part given elsewhere only fills an empty one. */
	public void reachAtIfUnknown(@Nullable String country, @Nullable String phone) {
		if (this.country == null) {
			this.country = given(country);
		}
		if (this.phone == null) {
			this.phone = given(phone);
		}
	}

	private static @Nullable String given(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	/** Keeps the name a person already has; a provider's name only fills an empty one. */
	public void nameIfUnnamed(@Nullable String name) {
		if (displayName == null && name != null && !name.isBlank()) {
			displayName = name.strip();
		}
	}
}
