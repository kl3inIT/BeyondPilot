package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProposalReviewDecisionRepository extends JpaRepository<ProposalReviewDecision, UUID> {

	List<ProposalReviewDecision> findByProposalIdOrderByDecidedAt(UUID proposalId);
}
