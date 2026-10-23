package ai.genaifund.beyondpilot.perk.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PerkRepository extends JpaRepository<Perk, UUID> {

	/**
	 * The perk, locked until the transaction ends: two saves act one after the other, and so do two teams claiming its
	 * last place.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Perk p where p.id = :id")
	Optional<Perk> findForUpdate(UUID id);

	Optional<Perk> findBySlug(String slug);

	boolean existsBySlug(String slug);

	/** Whether another perk of the organization reads the same; the identifier is one no perk has for a new perk. */
	@Query("""
			select count(p) > 0 from Perk p
			where p.organizationId = :organizationId and lower(p.title) = lower(:title) and p.id <> :id
			""")
	boolean existsOtherOfOrganization(UUID organizationId, String title, UUID id);

	/** The perks an organization gives, the most recently changed first. */
	List<Perk> findByOrganizationIdOrderByUpdatedAtDesc(UUID organizationId);

	/** The perks in this state, the most recently published first. */
	List<Perk> findByStateOrderByPublishedAtDesc(String state);

	/** The published perks for a program's teams, or that an operator added to its page, the newest first. */
	@Query("""
			select p from Perk p
			where p.state = 'published' and (p.programId = :programId or :programId member of p.shownOnProgramIds)
			order by p.publishedAt desc
			""")
	List<Perk> findPublishedForProgram(UUID programId);

	/** The published perks that go with any of these solutions. */
	@Query("select distinct p from Perk p join p.solutionIds s where p.state = 'published' and s in :solutionIds")
	List<Perk> findPublishedWithSolutions(Collection<UUID> solutionIds);

	/** Every perk, the most recently changed first. */
	List<Perk> findAllByOrderByUpdatedAtDesc();

	/**
	 * Gives the perks of a merged organization to the one kept. Each version moves on, so a save read before the merge
	 * is refused.
	 */
	@Modifying(flushAutomatically = true)
	@Query("update Perk p set p.organizationId = :into, p.version = p.version + 1 where p.organizationId = :from")
	void moveToOrganization(UUID from, UUID into);
}
