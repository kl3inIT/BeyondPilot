package ai.genaifund.beyondpilot.solution.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OfferRepository extends JpaRepository<Offer, UUID> {

	/** The offer, locked until the transaction ends, so two operators who change it act one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from Offer o where o.id = :id")
	Optional<Offer> findForUpdate(UUID id);

	/**
	 * Whether another offer of GenAI Fund's list reads the same; the identifier is one no offer has for a new offer.
	 */
	@Query("""
			select count(o) > 0 from Offer o
			where o.organizationId is null and lower(o.title) = lower(:title) and o.id <> :id
			""")
	boolean existsOtherOfTheList(String title, UUID id);

	/** Whether another offer of the organization reads the same. */
	@Query("""
			select count(o) > 0 from Offer o
			where o.organizationId = :organizationId and lower(o.title) = lower(:title) and o.id <> :id
			""")
	boolean existsOtherOfOrganization(UUID organizationId, String title, UUID id);

	/** The solutions that come with the offer. */
	@Query(value = "select solution_id from solution_offer where offer_id = :id", nativeQuery = true)
	List<UUID> findSolutionIds(UUID id);

	/** How many solutions come with the offer. */
	@Query(value = "select count(*) from solution_offer where offer_id = :id", nativeQuery = true)
	long countSolutions(UUID id);
}
