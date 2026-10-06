package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ProposalRepository extends JpaRepository<Proposal, UUID> {

	Optional<Proposal> findByProgramIdAndAccountId(UUID programId, UUID accountId);

	/** The application, locked until the transaction ends, so two tabs saving it act one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Proposal p where p.programId = :programId and p.accountId = :accountId")
	Optional<Proposal> findForUpdate(UUID programId, UUID accountId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Proposal p where p.id = :id")
	Optional<Proposal> findForUpdate(UUID id);

	/** The person's applications, the most recently changed first. */
	List<Proposal> findByAccountIdOrderByUpdatedAtDesc(UUID accountId);

	/** Whether someone else of the organization has a submitted application to the program. */
	boolean existsByProgramIdAndOrganizationIdAndStatusAndAccountIdNot(UUID programId, UUID organizationId,
			String status, UUID accountId);
}
