package ai.genaifund.beyondpilot.usecase.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UseCaseRepository extends JpaRepository<UseCase, UUID> {

	/** One use case, locked for the change the caller is about to make. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from UseCase u where u.id = :id")
	Optional<UseCase> findForUpdate(@Param("id") UUID id);

	/**
	 * Features a use case that is not featured, in one statement, so two operators who feature it together feature it
	 * once and the first time stays. It leaves the version alone: the owner's save in another tab is not refused for
	 * it.
	 * @return 1 when it was featured now, 0 when it was featured already
	 */
	@Modifying
	@Query(value = "update use_case set featured_at = :at where id = :id and featured_at is null", nativeQuery = true)
	int feature(@Param("id") UUID id, @Param("at") Instant at);

	/** Stops featuring a use case; 1 when it was featured until now, 0 when it was not featured. */
	@Modifying
	@Query(value = "update use_case set featured_at = null where id = :id and featured_at is not null",
			nativeQuery = true)
	int unfeature(@Param("id") UUID id);

	/** The use cases of one organization, the most recently touched first. */
	List<UseCase> findByOrganizationIdOrderByUpdatedAtDescIdAsc(UUID organizationId);

	List<UseCase> findByStatus(String status);

	/** The use cases of this status attached to a program, the oldest published first. */
	@Query("select u.id from UseCase u join u.programIds p where p = :programId and u.status = :status"
			+ " order by u.publishedAt, u.id")
	List<UUID> findIdsByProgram(@Param("programId") UUID programId, @Param("status") String status);

	/** Whether a file is already attached to a use case. */
	@Query("select count(u) > 0 from UseCase u join u.attachmentFileIds f where f = :fileId")
	boolean attachmentExists(@Param("fileId") UUID fileId);
}
