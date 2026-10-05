package ai.genaifund.beyondpilot.organization.persistence;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

	/**
	 * The organization, locked until the transaction ends. Every change to who belongs to it takes this lock first, so
	 * two of them act one after the other and the rule that an owned organization keeps an owner holds.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from Organization o where o.id = :id")
	Optional<Organization> findForUpdate(UUID id);

	boolean existsBySlug(String slug);

	Optional<Organization> findBySlug(String slug);

	Optional<Organization> findByEmailDomain(String emailDomain);
}
