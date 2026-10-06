package ai.genaifund.beyondpilot.proposal.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.jspecify.annotations.Nullable;

/**
 * A judge invited to a program by address. The person who signs in with that address reviews the program until they
 * are removed; an invitation nobody used lapses.
 */
@Entity
@Table(name = "proposal_reviewer")
public class ProposalReviewer {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID programId;

	@Column(nullable = false, updatable = false)
	private String email;

	private @Nullable UUID accountId;

	@Column(nullable = false, updatable = false)
	private UUID invitedByAccountId;

	@Column(nullable = false)
	private Instant invitedAt;

	@Column(nullable = false)
	private Instant expiresAt;

	private @Nullable Instant joinedAt;

	private @Nullable Instant removedAt;

	@SuppressWarnings("NullAway.Init")
	protected ProposalReviewer() {
	}

	public ProposalReviewer(UUID id, UUID programId, String email, UUID invitedByAccountId, Instant invitedAt,
			Instant expiresAt) {
		this.id = id;
		this.programId = programId;
		this.email = email;
		this.invitedByAccountId = invitedByAccountId;
		this.invitedAt = invitedAt;
		this.expiresAt = expiresAt;
	}

	/** Whether the person behind the address may review now: they joined, or the invitation has not lapsed. */
	public boolean isActiveAt(Instant now) {
		return removedAt == null && (joinedAt != null || now.isBefore(expiresAt));
	}

	public boolean isOpen() {
		return removedAt == null;
	}

	public boolean hasJoined() {
		return joinedAt != null;
	}

	/** The first time the invited person opens the review. */
	public void join(UUID accountId, Instant at) {
		this.accountId = accountId;
		this.joinedAt = at;
	}

	/** Sends an invitation nobody used again, for another period. */
	public void renew(Instant at, Instant expiresAt) {
		this.invitedAt = at;
		this.expiresAt = expiresAt;
	}

	public void remove(Instant at) {
		this.removedAt = at;
	}

	public UUID getId() {
		return id;
	}

	public UUID getProgramId() {
		return programId;
	}

	public String getEmail() {
		return email;
	}

	public @Nullable UUID getAccountId() {
		return accountId;
	}

	public Instant getInvitedAt() {
		return invitedAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public @Nullable Instant getJoinedAt() {
		return joinedAt;
	}
}
