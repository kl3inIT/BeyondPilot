package ai.genaifund.beyondpilot.ai.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AiModelRepository extends JpaRepository<AiModel, UUID> {

	List<AiModel> findByProviderIdInOrderByModelName(Collection<UUID> providerIds);

	boolean existsByProviderIdAndModelName(UUID providerId, String modelName);

}
