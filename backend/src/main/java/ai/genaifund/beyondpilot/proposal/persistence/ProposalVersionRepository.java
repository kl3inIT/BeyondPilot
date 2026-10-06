package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProposalVersionRepository extends JpaRepository<ProposalVersion, ProposalVersion.Key> {

	List<ProposalVersion> findByProposalIdOrderByNumber(UUID proposalId);
}
