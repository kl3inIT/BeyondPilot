package ai.genaifund.beyondpilot.talent.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TalentProfileRepository extends JpaRepository<TalentProfile, UUID> {

	/**
	 * The profile, locked until the transaction ends, so a save, a submission and a decision that arrive together act
	 * one after the other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from TalentProfile p where p.id = :id")
	Optional<TalentProfile> findForUpdate(UUID id);

	/**
	 * Pins a profile that is not pinned, in one statement, so two operators who pin it together pin it once and the
	 * first time stays. It leaves the version alone: the owner's save in another tab is not refused for it.
	 * @return 1 when it was pinned now, 0 when it was pinned already
	 */
	@Modifying
	@Query(value = "update talent_profile set pinned_at = :at where id = :id and pinned_at is null", nativeQuery = true)
	int pin(UUID id, Instant at);

	/** Unpins a pinned profile; 1 when it was unpinned now, 0 when it was not pinned. */
	@Modifying
	@Query(value = "update talent_profile set pinned_at = null where id = :id and pinned_at is not null",
			nativeQuery = true)
	int unpin(UUID id);

	/** The profile of an account, locked the same way. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from TalentProfile p where p.accountId = :accountId")
	Optional<TalentProfile> findByAccountForUpdate(UUID accountId);

	Optional<TalentProfile> findByAccountId(UUID accountId);

	Optional<TalentProfile> findBySlug(String slug);

	List<TalentProfile> findByStatusAndListedTrueAndSuspendedAtIsNull(String status);

	boolean existsBySlug(String slug);

	boolean existsByPhotoFileId(UUID photoFileId);
}
