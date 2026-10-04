package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
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
	 * Records one wrong code in the database itself, so guesses that arrive together are each counted.
	 * @return the number of wrong codes after this one, or 0 when the challenge is gone
	 */
	@Query(value = """
			update identity_sign_in_challenge set failed_attempts = failed_attempts + 1
			where id = :id returning failed_attempts
			""", nativeQuery = true)
	Integer recordFailedAttempt(UUID id);

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
