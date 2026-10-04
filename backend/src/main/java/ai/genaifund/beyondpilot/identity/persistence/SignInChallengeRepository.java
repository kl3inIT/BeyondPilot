package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SignInChallengeRepository extends JpaRepository<SignInChallenge, UUID> {

	/** How many codes sent to this address still work at the given moment. */
	@Query("select count(c) from SignInChallenge c where lower(c.email) = lower(:email) and c.expiresAt > :at")
	int countUnexpired(String email, Instant at);

	/**
	 * Makes requests for one address take turns until the surrounding transaction ends, so that counting its codes
	 * and adding one is a single step.
	 */
	@Query(value = "select 1 from pg_advisory_xact_lock(hashtext(lower(:email)))", nativeQuery = true)
	Integer takeTurnFor(String email);

	/**
	 * Takes one of the challenge's guesses before the guess is looked at, in the database itself: of any number of
	 * guesses that arrive together, only as many as are left get a turn. A right guess removes the challenge, so the
	 * count only ever matters for wrong ones.
	 * @return the guesses used after this one; empty when none was left or the challenge is gone
	 */
	@Query(value = """
			update identity_sign_in_challenge set failed_attempts = failed_attempts + 1
			where id = :id and failed_attempts < :allowed returning failed_attempts
			""", nativeQuery = true)
	List<Integer> takeGuess(UUID id, int allowed);

	/** The wrong codes typed for this address since the given moment, over all of its codes. */
	@Query("select coalesce(sum(c.failedAttempts), 0) from SignInChallenge c "
			+ "where lower(c.email) = lower(:email) and c.createdAt > :since")
	long wrongCodesSince(String email, Instant since);

	/**
	 * Uses the challenge up.
	 * @return 1 for the one caller that removed it, 0 for any other
	 */
	@Modifying
	@Query("delete from SignInChallenge c where c.id = :id")
	int remove(UUID id);

	@Modifying
	@Query("delete from SignInChallenge c where c.expiresAt < :before")
	int removeExpiredBefore(Instant before);
}
