package ai.genaifund.beyondpilot.solution.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.solution.SolutionDeckFile;
import ai.genaifund.beyondpilot.solution.SolutionMaterial;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SolutionRepository extends JpaRepository<Solution, UUID> {

	/**
	 * The solution, locked until the transaction ends, so a save, a submission and a decision that arrive together act
	 * one after the other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Solution s where s.id = :id")
	Optional<Solution> findForUpdate(UUID id);

	List<Solution> findByStatusAndSuspendedAtIsNull(String status);

	/** The deck of every solution of a status that is not taken down, without loading the solutions. */
	@Query("""
			select new ai.genaifund.beyondpilot.solution.SolutionDeckFile(s.id, s.deckFileId) from Solution s
			where s.status = :status and s.suspendedAt is null and s.deckFileId is not null
			""")
	List<SolutionDeckFile> findDecksByStatus(String status);

	/** Whether each of these solutions has a deck and names a website, without loading the solutions. */
	@Query("""
			select new ai.genaifund.beyondpilot.solution.SolutionMaterial(s.id,
			    case when s.deckFileId is null then false else true end,
			    case when s.website is null or trim(s.website) = '' then false else true end)
			from Solution s where s.id in :ids
			""")
	List<SolutionMaterial> findMaterialByIdIn(Collection<UUID> ids);

	boolean existsBySlug(String slug);

	boolean existsByDeckFileId(UUID deckFileId);

	/** Whether a solution names the file as its logo, its cover or one of the images under the cover. */
	@Query(value = """
			select exists (select 1 from solution
			               where logo_file_id = :fileId or cover_file_id = :fileId or :fileId = any (image_file_ids))
			""", nativeQuery = true)
	boolean existsByPicture(UUID fileId);

	Optional<Solution> findBySlug(String slug);

	List<Solution> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
}
