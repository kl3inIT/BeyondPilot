package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProposalReviewerRepository extends JpaRepository<ProposalReviewer, UUID> {

	/** The judges of a program who were not removed, in the order they were invited. */
	List<ProposalReviewer> findByProgramIdAndRemovedAtIsNullOrderByInvitedAt(UUID programId);

	/** The invitation of an address to a program, if it was not removed. */
	@Query("select r from ProposalReviewer r where r.programId = :programId and lower(r.email) = lower(:email) and r.removedAt is null")
	Optional<ProposalReviewer> findOpen(UUID programId, String email);

	/** The accounts that joined a program as judges, whether or not they were removed since. */
	@Query("select r.accountId from ProposalReviewer r where r.programId = :programId and r.accountId is not null")
	List<UUID> findJudgeAccounts(UUID programId);

	/** Every invitation of an address that was not removed, whichever program it is for. */
	@Query("select r from ProposalReviewer r where lower(r.email) = lower(:email) and r.removedAt is null order by r.invitedAt")
	List<ProposalReviewer> findOpenFor(String email);
}
