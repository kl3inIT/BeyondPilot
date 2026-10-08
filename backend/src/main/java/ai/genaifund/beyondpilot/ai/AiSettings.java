package ai.genaifund.beyondpilot.ai;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * What the AI module reads from the environment ({@code beyondpilot.ai} in application.yaml). Providers, keys and
 * models are what operators set in Admin › AI.
 * @param encryptionKey 32 bytes in Base64 that seal the providers' keys; without it no key is stored or read
 */
@ConfigurationProperties("beyondpilot.ai")
record AiSettings(@Nullable String encryptionKey) {
}
