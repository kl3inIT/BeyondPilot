package ai.genaifund.beyondpilot.program.persistence;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ProgramRepository extends JpaRepository<Program, UUID> {

	/**
	 * The program, locked until the transaction ends, so two operators saving it at the same moment act one after the
	 * other and the second is told that it changed.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Program p where p.id = :id")
	Optional<Program> findForUpdate(UUID id);

	Optional<Program> findBySlug(String slug);

	boolean existsBySlug(String slug);

	boolean existsByCoverFileId(UUID coverFileId);
}
