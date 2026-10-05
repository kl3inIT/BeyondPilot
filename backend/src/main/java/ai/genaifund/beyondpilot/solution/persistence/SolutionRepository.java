package ai.genaifund.beyondpilot.solution.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SolutionRepository extends JpaRepository<Solution, UUID> {

	/**
	 * The solution, locked until the transaction ends, so a save, a submission and a decision that arrive together act
	 * one after the other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Solution s where s.id = :id")
	Optional<Solution> findForUpdate(UUID id);

	boolean existsBySlug(String slug);

	Optional<Solution> findBySlug(String slug);

	List<Solution> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
}
