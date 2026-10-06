package ai.genaifund.beyondpilot.proposal.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProposalVersionRepository extends JpaRepository<ProposalVersion, ProposalVersion.Key> {
}
