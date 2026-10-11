package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UseCaseProposalSolutionRepository
		extends JpaRepository<UseCaseProposalSolution, UseCaseProposalSolution.Key> {

	List<UseCaseProposalSolution> findByProposalIdOrderByPosition(UUID proposalId);

	List<UseCaseProposalSolution> findByProposalIdInOrderByPosition(Collection<UUID> proposalIds);

	/** Takes every solution off the proposal, so the form's list replaces it whole. */
	@Modifying(flushAutomatically = true)
	@Query("delete from UseCaseProposalSolution s where s.proposalId = :proposalId")
	void deleteAllOf(UUID proposalId);
}
