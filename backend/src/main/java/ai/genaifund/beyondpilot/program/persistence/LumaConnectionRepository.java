package ai.genaifund.beyondpilot.program.persistence;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/** The one row of the Luma connection, or none. */
public interface LumaConnectionRepository extends JpaRepository<LumaConnection, Short> {

	default Optional<LumaConnection> current() {
		return findById(LumaConnection.ID);
	}

}
