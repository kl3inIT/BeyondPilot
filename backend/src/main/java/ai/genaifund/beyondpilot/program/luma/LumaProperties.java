package ai.genaifund.beyondpilot.program.luma;

import java.net.URI;
import java.time.Duration;
import java.util.Set;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How the GenAI Fund calendar on Luma is read (BEY-190, BEY-245). Which calendar, and the key to it, an operator gives
 * in Admin; nothing here names one.
 * @param api Luma's public API
 * @param siteUrl the public address of the site, to which Luma sends its webhooks
 * @param encryptionKey 32 bytes in Base64 that seal the key and the webhook's secret; without it none can be saved
 * @param hosts the only hosts the covers are downloaded from
 * @param interval how long the job waits after a read before the next
 * @param timeout how long one call may last, from sending to the last byte
 */
@ConfigurationProperties("beyondpilot.program.luma")
public record LumaProperties(@DefaultValue("https://public-api.luma.com") URI api,
		@DefaultValue("http://localhost:3000") URI siteUrl, @Nullable String encryptionKey,
		@DefaultValue({ "images.lumacdn.com" }) Set<String> hosts, @DefaultValue("1h") Duration interval,
		@DefaultValue("15s") Duration timeout) {
}
