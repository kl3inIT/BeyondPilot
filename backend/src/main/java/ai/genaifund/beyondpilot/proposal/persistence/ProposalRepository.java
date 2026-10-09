package ai.genaifund.beyondpilot.proposal.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProposalRepository extends JpaRepository<Proposal, UUID> {

	/**
	 * Gives the applications of a merged organization to the one kept. Each version moves on, so a save read before
	 * the merge is refused instead of writing the former organization back.
	 */
	@Modifying(flushAutomatically = true)
	@Query("update Proposal p set p.organizationId = :into, p.version = p.version + 1 where p.organizationId = :from")
	void moveToOrganization(UUID from, UUID into);

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

	/** The submitted applications of a program, the earliest first. */
	List<Proposal> findByProgramIdAndStatusOrderBySubmittedAt(UUID programId, String status);

	long countByProgramIdAndStatus(UUID programId, String status);

	/** The programs that have a submitted application. */
	@Query("select distinct p.programId from Proposal p where p.status = 'submitted'")
	List<UUID> findProgramsWithSubmissions();

	/** Records GenAI Fund's decision without touching the version the applicant edits. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("update Proposal p set p.reviewStatus = :reviewStatus where p.id = :id")
	void decide(UUID id, String reviewStatus);

	/** Whether someone else of the organization has a submitted application to the program. */
	boolean existsByProgramIdAndOrganizationIdAndStatusAndAccountIdNot(UUID programId, UUID organizationId,
			String status, UUID accountId);
}
