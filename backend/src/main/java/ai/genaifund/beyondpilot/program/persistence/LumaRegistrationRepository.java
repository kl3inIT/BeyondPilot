package ai.genaifund.beyondpilot.program.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

/** The registrations for Luma events made on BeyondPilot. */
public interface LumaRegistrationRepository extends JpaRepository<LumaRegistration, UUID> {

	Optional<LumaRegistration> findByProgramIdAndAccountId(UUID programId, UUID accountId);

	Optional<LumaRegistration> findByTicket(String ticket);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select registration from LumaRegistration registration where registration.id = :id")
	Optional<LumaRegistration> findForUpdate(UUID id);

	/** The registrations of the program that Luma has. */
	@Query("""
			select registration.id from LumaRegistration registration
			where registration.programId = :programId and registration.sendState = 'sent'""")
	List<UUID> findSentOf(UUID programId);

	/** The programs with a registration Luma has. */
	/** The addresses, lowercase, of those who registered here for the program. */
	@Query("select lower(registration.email) from LumaRegistration registration where registration.programId = :programId")
	List<String> findEmailsOf(UUID programId);

	@Query("select distinct registration.programId from LumaRegistration registration where registration.sendState = 'sent'")
	List<UUID> findProgramsWithSent();

	/** The registrations waiting to be sent whose next attempt is due, the oldest first. */
	@Query("""
			select registration.id from LumaRegistration registration
			where registration.sendState = 'waiting' and registration.nextAttemptAt <= :now
			order by registration.nextAttemptAt""")
	List<UUID> findDue(Instant now);

}
