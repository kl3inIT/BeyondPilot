package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A published use case as a proposal to it needs to know it.
 * @param proposalEditDays how many days after sending a proposal its organization may still edit it; 0 for none
 * @param open whether proposals may still be sent: it has not closed and its organization is approved
 */
public record UseCaseTarget(UUID id, UUID organizationId, String title, @Nullable Instant closesAt,
		int proposalEditDays, boolean open) {
}
