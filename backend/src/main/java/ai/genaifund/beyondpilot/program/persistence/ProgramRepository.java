package ai.genaifund.beyondpilot.program.persistence;

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

public interface ProgramRepository extends JpaRepository<Program, UUID> {

	/**
	 * The program, locked until the transaction ends, so two operators saving it at the same moment act one after the
	 * other and the second is told that it changed.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Program p where p.id = :id")
	Optional<Program> findForUpdate(UUID id);

	Optional<Program> findBySlug(String slug);

	List<Program> findByStatus(ProgramStatus status);

	boolean existsBySlug(String slug);

	boolean existsByCoverFileId(UUID coverFileId);

	/**
	 * Features a program that is not featured, in one statement, so two operators who feature it together feature it
	 * once and the first time stays. It leaves the version alone: an operator's save in another tab is not refused
	 * for it.
	 * @return 1 when it was featured now, 0 when it was featured already
	 */
	@Modifying
	@Query(value = "update program set featured_at = :at where id = :id and featured_at is null", nativeQuery = true)
	int feature(@Param("id") UUID id, @Param("at") Instant at);

	/** Stops featuring a program; 1 when it was featured until now, 0 when it was not featured. */
	@Modifying
	@Query(value = "update program set featured_at = null where id = :id and featured_at is not null",
			nativeQuery = true)
	int unfeature(@Param("id") UUID id);
}
