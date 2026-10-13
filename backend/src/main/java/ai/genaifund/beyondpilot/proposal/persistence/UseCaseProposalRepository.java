package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UseCaseProposalRepository extends JpaRepository<UseCaseProposal, UUID> {

	Optional<UseCaseProposal> findByUseCaseIdAndOrganizationId(UUID useCaseId, UUID organizationId);

	/** The proposal, locked until the transaction ends, so two members saving it act one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from UseCaseProposal p where p.useCaseId = :useCaseId and p.organizationId = :organizationId")
	Optional<UseCaseProposal> findForUpdate(UUID useCaseId, UUID organizationId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from UseCaseProposal p where p.id = :id")
	Optional<UseCaseProposal> findForUpdate(UUID id);

	/** The proposals a use case received, the latest first. */
	List<UseCaseProposal> findByUseCaseIdAndStatusOrderBySentAtDesc(UUID useCaseId, String status);

	/** The proposals a use case received, locked until the transaction ends, so two members sending outcomes act one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from UseCaseProposal p where p.useCaseId = :useCaseId and p.status = 'sent' order by p.sentAt desc")
	List<UseCaseProposal> findSentForUpdate(UUID useCaseId);

	/** How many proposals each of these use cases received; one that received none is not in the answer. */
	@Query("select p.useCaseId as useCaseId, count(p) as sent from UseCaseProposal p"
			+ " where p.status = 'sent' and p.useCaseId in :useCaseIds group by p.useCaseId")
	List<Count> countSent(Collection<UUID> useCaseIds);

	/**
	 * Gives the proposals of a merged organization to the one kept, except those for a use case the kept one also has a
	 * proposal for. Each version moves on, so a save read before the merge is refused instead of writing the former
	 * organization back.
	 */
	@Modifying(flushAutomatically = true)
	@Query("update UseCaseProposal p set p.organizationId = :into, p.version = p.version + 1"
			+ " where p.organizationId = :from and not exists (select 1 from UseCaseProposal k"
			+ " where k.useCaseId = p.useCaseId and k.organizationId = :into)")
	void moveToOrganization(UUID from, UUID into);

	/** Drops the drafts left with a merged organization: the kept one has its own proposal for those use cases. */
	@Modifying(flushAutomatically = true)
	@Query("delete from UseCaseProposal p where p.organizationId = :from and p.status = 'draft'")
	void deleteDraftsOf(UUID from);

	/** The number of sent proposals of one use case. */
	interface Count {

		UUID getUseCaseId();

		long getSent();
	}
}
