package ai.genaifund.beyondpilot.identity.persistence;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ExternalIdentityRepository extends JpaRepository<ExternalIdentity, UUID> {

	Optional<ExternalIdentity> findByProviderAndSubject(String provider, String subject);

	/**
	 * Links the subject to the account unless it is linked already. Two first sign-ins of one subject may race; the
	 * unique key decides and the second one changes nothing.
	 */
	@Modifying
	@Query(value = """
			insert into identity_external_identity (id, account_id, provider, subject)
			values (:id, :accountId, :provider, :subject)
			on conflict (provider, subject) do nothing
			""", nativeQuery = true)
	void insertIfAbsent(UUID id, UUID accountId, String provider, String subject);
}
