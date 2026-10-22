package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProposalAssessmentRepository extends JpaRepository<ProposalAssessment, ProposalAssessment.Key> {

	List<ProposalAssessment> findByProposalIdIn(Collection<UUID> proposalIds);

	List<ProposalAssessment> findByProposalIdOrderBySavedAt(UUID proposalId);

	/**
	 * Whether anyone has scored an application of the program, which fixes its criteria. A note or a bookmark holds
	 * no scores and fixes nothing.
	 */
	@Query(value = """
			select exists (select 1 from proposal_assessment a join proposal p on p.id = a.proposal_id
			               where p.program_id = :programId and a.scores <> '{}'::jsonb)
			""", nativeQuery = true)
	boolean existsForProgram(UUID programId);
}
