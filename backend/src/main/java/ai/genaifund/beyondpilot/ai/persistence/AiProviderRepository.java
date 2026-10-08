package ai.genaifund.beyondpilot.search.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AiProviderRepository extends JpaRepository<AiProvider, UUID> {

	List<AiProvider> findByPurposeOrderByName(String purpose);

	boolean existsByPurposeAndNameIgnoreCase(String purpose, String name);

}
