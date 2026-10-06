package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProposalAssessmentRepository extends JpaRepository<ProposalAssessment, ProposalAssessment.Key> {

	List<ProposalAssessment> findByProposalIdIn(Collection<UUID> proposalIds);

	List<ProposalAssessment> findByProposalIdOrderBySavedAt(UUID proposalId);

	/** Whether anyone has assessed an application of the program, which fixes its criteria. */
	@Query("select count(a) > 0 from ProposalAssessment a, Proposal p where p.id = a.proposalId and p.programId = :programId")
	boolean existsForProgram(UUID programId);
}
