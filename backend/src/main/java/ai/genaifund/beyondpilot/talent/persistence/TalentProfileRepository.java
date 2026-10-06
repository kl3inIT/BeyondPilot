package ai.genaifund.beyondpilot.talent.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface TalentProfileRepository extends JpaRepository<TalentProfile, UUID> {

	/**
	 * The profile, locked until the transaction ends, so a save, a submission and a decision that arrive together act
	 * one after the other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from TalentProfile p where p.id = :id")
	Optional<TalentProfile> findForUpdate(UUID id);

	/** The profile of an account, locked the same way. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from TalentProfile p where p.accountId = :accountId")
	Optional<TalentProfile> findByAccountForUpdate(UUID accountId);

	Optional<TalentProfile> findByAccountId(UUID accountId);

	Optional<TalentProfile> findBySlug(String slug);

	List<TalentProfile> findByStatusAndListedTrue(String status);

	boolean existsBySlug(String slug);

	boolean existsByPhotoFileId(UUID photoFileId);
}
