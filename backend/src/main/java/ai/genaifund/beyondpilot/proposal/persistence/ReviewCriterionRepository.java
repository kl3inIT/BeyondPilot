package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ReviewCriterionRepository extends JpaRepository<ReviewCriterion, UUID> {

	List<ReviewCriterion> findByProgramIdOrderByPosition(UUID programId);

	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from ReviewCriterion c where c.programId = :programId")
	void deleteByProgramId(UUID programId);
}
