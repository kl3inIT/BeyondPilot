package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProposalReleaseRepository extends JpaRepository<ProposalRelease, UUID> {
}
