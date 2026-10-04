package ai.genaifund.beyondpilot.identity.persistence;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AccountRepository extends JpaRepository<Account, UUID> {

	/**
	 * The account, locked until the transaction ends, so two operators changing it at the same moment act one after
	 * the other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select a from Account a where a.id = :id")
	Optional<Account> findForUpdate(UUID id);

	/** Addresses are one account whatever their letter case. */
	@Query("select a from Account a where lower(a.email) = lower(:email)")
	Optional<Account> findByEmail(String email);

	/**
	 * Creates the account unless the address already has one. Two first sign-ins with one address may race; the unique
	 * index decides and both then read the same row.
	 */
	@Modifying
	@Query(value = """
			insert into identity_account (id, email, display_name)
			values (:id, :email, :displayName)
			on conflict (lower(email)) do nothing
			""", nativeQuery = true)
	void insertIfAbsent(UUID id, String email, @Nullable String displayName);
}
