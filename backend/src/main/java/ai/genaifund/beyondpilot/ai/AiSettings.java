package ai.genaifund.beyondpilot.ai;

import java.time.Duration;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * What the AI module reads from the environment ({@code beyondpilot.ai} in application.yaml). Providers, keys and
 * models are what operators set in Admin › AI.
 * @param encryptionKey 32 bytes in Base64 that seal the providers' keys; without it no key is stored or read
 * @param listTimeout how long listing a provider's models, which is also its connection test, may take
 * @param callTimeout how long one call to a chat model may take
 * @param maxClients how many chat clients are kept at once, those still answering included
 */
@ConfigurationProperties("beyondpilot.ai")
record AiSettings(@Nullable String encryptionKey, @DefaultValue("20s") Duration listTimeout,
		@DefaultValue("120s") Duration callTimeout, @DefaultValue("32") int maxClients) {
}
