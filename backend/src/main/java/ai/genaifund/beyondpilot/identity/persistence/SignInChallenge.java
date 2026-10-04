package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One emailed sign-in code, waiting to be typed into the browser that asked for it. The identifier stays in that
 * browser's session and never travels by email; the code is stored only as a hash.
 */
@Entity
@Table(name = "identity_sign_in_challenge")
public class SignInChallenge {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private String email;

	@Column(nullable = false, updatable = false)
	private String codeHash;

	@Column(nullable = false)
	private int failedAttempts;

	@Column(nullable = false, updatable = false)
	private Instant expiresAt;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@SuppressWarnings("NullAway.Init")
	protected SignInChallenge() {
	}

	public SignInChallenge(UUID id, String email, String codeHash, Instant createdAt, Instant expiresAt) {
		this.id = id;
		this.email = email;
		this.codeHash = codeHash;
		this.expiresAt = expiresAt;
		this.createdAt = createdAt;
	}

	public String getEmail() {
		return email;
	}

	public String getCodeHash() {
		return codeHash;
	}

	public int getFailedAttempts() {
		return failedAttempts;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
