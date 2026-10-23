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

	/** The applications of a program in a status, the most recently saved first. */
	List<Proposal> findByProgramIdAndStatusOrderByUpdatedAtDesc(UUID programId, String status);

	/** The submitted applications of a program, the earliest first. */
	List<Proposal> findByProgramIdAndStatusOrderBySubmittedAt(UUID programId, String status);

	long countByProgramIdAndStatus(UUID programId, String status);

	/**
	 * The review statuses of the submitted applications to a program by an organization or, for one sent before the
	 * person belonged to it, by the person.
	 */
	@Query("""
			select p.reviewStatus from Proposal p
			where p.programId = :programId and p.status = 'submitted'
			  and (p.organizationId = :organizationId or p.accountId = :accountId)
			""")
	List<String> findSubmittedReviewStatuses(UUID programId, UUID organizationId, UUID accountId);

	/** The programs that have a submitted application. */
	@Query("select distinct p.programId from Proposal p where p.status = 'submitted'")
	List<UUID> findProgramsWithSubmissions();

	/** How many applications each program has in each status; a program with none is absent. */
	@Query("select p.programId as programId, p.status as status, count(p) as count from Proposal p "
			+ "group by p.programId, p.status")
	List<StatusCount> countByProgramAndStatus();

	interface StatusCount {

		UUID getProgramId();

		String getStatus();

		long getCount();

	}

	/** Records GenAI Fund's decision without touching the version the applicant edits. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("update Proposal p set p.reviewStatus = :reviewStatus where p.id = :id")
	void decide(UUID id, String reviewStatus);

	/**
	 * Whether an application, a version of one or a use case proposal names the file, as its deck or in an answer. A
	 * person may bring a file they uploaded for one to another.
	 */
	@Query(nativeQuery = true, value = """
			select exists (select 1 from proposal
			               where deck_file_id = :fileId or answers::text like '%' || cast(:fileId as text) || '%')
			    or exists (select 1 from proposal_version where snapshot::text like '%' || cast(:fileId as text) || '%')
			    or exists (select 1 from use_case_proposal where deck_file_id = :fileId)
			""")
	boolean fileNamed(UUID fileId);

	/** Whether the organization ever submitted an application, to any program. */
	boolean existsByOrganizationIdAndSubmittedAtIsNotNull(UUID organizationId);

	/** Whether someone else of the organization has a submitted application to the program. */
	boolean existsByProgramIdAndOrganizationIdAndStatusAndAccountIdNot(UUID programId, UUID organizationId,
			String status, UUID accountId);
}
