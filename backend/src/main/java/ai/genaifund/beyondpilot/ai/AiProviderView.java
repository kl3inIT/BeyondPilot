package ai.genaifund.beyondpilot.ai;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A provider as a screen shows it. Its key is never part of it: only whether it has one.
 * @param vendor the vendor of an embedding provider; null for a chat provider
 * @param adapterType the adapter that speaks its API
 * @param updatedBy who saved it last, as they were named
 * @param version what a change sends back, so a change made meanwhile is refused
 * @param pricePerThousandCalls what 1,000 calls cost in US dollars, for a service that bills by the call; null
 * otherwise, and when it is not known
 */
public record AiProviderView(UUID id, @Nullable String vendor, String adapterType, String name, String baseUrl,
		boolean enabled, boolean hasKey, String updatedBy, Instant updatedAt, long version,
		@Nullable BigDecimal pricePerThousandCalls) {
}
