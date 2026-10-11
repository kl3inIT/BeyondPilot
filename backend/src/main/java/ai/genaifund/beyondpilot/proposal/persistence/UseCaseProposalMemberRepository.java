package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UseCaseProposalMemberRepository
		extends JpaRepository<UseCaseProposalMember, UseCaseProposalMember.Key> {

	List<UseCaseProposalMember> findByProposalIdOrderByPosition(UUID proposalId);

	List<UseCaseProposalMember> findByProposalIdInOrderByPosition(Collection<UUID> proposalIds);

	/** Takes every member off the proposal, so the form's list replaces it whole. */
	@Modifying(flushAutomatically = true)
	@Query("delete from UseCaseProposalMember m where m.proposalId = :proposalId")
	void deleteAllOf(UUID proposalId);
}
