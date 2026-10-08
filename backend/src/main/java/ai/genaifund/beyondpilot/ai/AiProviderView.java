package ai.genaifund.beyondpilot.ai;

import java.time.Instant;
import java.util.UUID;

/**
 * A provider as a screen shows it. Its key is never part of it: only whether it has one.
 * @param updatedBy who saved it last, as they were named
 * @param version what a change sends back, so a change made meanwhile is refused
 */
public record AiProviderView(UUID id, String vendor, String name, String baseUrl, boolean hasKey, String updatedBy,
		Instant updatedAt, long version) {
}
