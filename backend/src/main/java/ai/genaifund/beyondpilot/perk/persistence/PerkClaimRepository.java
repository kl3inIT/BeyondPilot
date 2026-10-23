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

public interface PerkClaimRepository extends JpaRepository<PerkClaim, UUID> {

	/** The claim, locked until the transaction ends, so two members deciding it act one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select c from PerkClaim c where c.id = :id")
	Optional<PerkClaim> findForUpdate(UUID id);

	/** The claim that holds a perk for an organization, the latest first: a declined request holds none. */
	@Query("""
			select c from PerkClaim c
			where c.perkId = :perkId and c.organizationId = :organizationId and c.state <> 'declined'
			order by c.createdAt desc
			""")
	List<PerkClaim> findActiveOfOrganization(UUID perkId, UUID organizationId);

	/** The claim that holds a perk for a person, the latest first. */
	@Query("""
			select c from PerkClaim c
			where c.perkId = :perkId and c.accountId = :accountId and c.state <> 'declined'
			order by c.createdAt desc
			""")
	List<PerkClaim> findActiveOfAccount(UUID perkId, UUID accountId);

	/** The latest claim of an organization on a perk, declined or not, so a declined request is shown as such. */
	Optional<PerkClaim> findFirstByPerkIdAndOrganizationIdOrderByCreatedAtDesc(UUID perkId, UUID organizationId);

	Optional<PerkClaim> findFirstByPerkIdAndAccountIdOrderByCreatedAtDesc(UUID perkId, UUID accountId);

	/** How many places of the perk are taken: every claim but a declined request. */
	@Query("select count(c) from PerkClaim c where c.perkId = :perkId and c.state <> 'declined'")
	long countActive(UUID perkId);

	long countByPerkId(UUID perkId);

	long countByPerkIdAndState(UUID perkId, String state);

	/** The claims a person made, the latest first. */
	List<PerkClaim> findByAccountIdOrderByCreatedAtDesc(UUID accountId);

	/** The claims of a perk, the latest first. */
	List<PerkClaim> findByPerkIdOrderByCreatedAtDesc(UUID perkId);

	/** The claims made for an organization, the latest first. */
	List<PerkClaim> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

	/** What each of these perks holds: every claim, with their states. */
	@Query("select c.perkId as perkId, c.state as state, count(c) as count from PerkClaim c "
			+ "where c.perkId in :perkIds group by c.perkId, c.state")
	List<StateCount> countByPerkAndState(Collection<UUID> perkIds);

	interface StateCount {

		UUID getPerkId();

		String getState();

		long getCount();
	}

	/** Gives the claims made for a merged organization to the one kept. */
	@Modifying(flushAutomatically = true)
	@Query("update PerkClaim c set c.organizationId = :into, c.version = c.version + 1 where c.organizationId = :from")
	void moveToOrganization(UUID from, UUID into);
}
