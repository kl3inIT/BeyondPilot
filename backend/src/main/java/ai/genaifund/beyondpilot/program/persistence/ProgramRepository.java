package ai.genaifund.beyondpilot.program.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProgramRepository extends JpaRepository<Program, UUID> {

	boolean existsBySlug(String slug);
}
