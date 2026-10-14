package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UseCaseProposalDecisionRepository extends JpaRepository<UseCaseProposalDecision, UUID> {

	List<UseCaseProposalDecision> findByProposalIdOrderByDecidedAt(UUID proposalId);
}
