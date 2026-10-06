package ai.genaifund.beyondpilot.solution.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface CustomerDeploymentRepository extends JpaRepository<CustomerDeployment, UUID> {

	/** The deployment, locked until the transaction ends, so a save and a decision act one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select d from CustomerDeployment d where d.id = :id")
	Optional<CustomerDeployment> findForUpdate(UUID id);

	List<CustomerDeployment> findBySolutionIdOrderByCreatedAtDesc(UUID solutionId);

	List<CustomerDeployment> findBySolutionIdAndStatusOrderByDecidedAtDesc(UUID solutionId, String status);

	int countBySolutionId(UUID solutionId);

	int countBySolutionIdAndStatus(UUID solutionId, String status);

	/** The approved deployments of the approved, listed solutions not taken down of an organization, the newest decision first. */
	@Query("""
			select d from CustomerDeployment d, Solution s
			where s.id = d.solutionId and s.organizationId = :organizationId and s.status = 'approved'
			  and s.listed = true and s.suspendedAt is null and d.status = 'approved'
			order by d.decidedAt desc, d.id
			""")
	List<CustomerDeployment> findPublicByOrganization(UUID organizationId, Pageable page);

	@Query("""
			select count(d) from CustomerDeployment d, Solution s
			where s.id = d.solutionId and s.organizationId = :organizationId and s.status = 'approved'
			  and s.listed = true and s.suspendedAt is null and d.status = 'approved'
			""")
	long countPublicByOrganization(UUID organizationId);

}
