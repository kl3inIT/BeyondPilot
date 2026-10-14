package ai.genaifund.beyondpilot.program.luma;

import java.net.URI;
import java.time.Duration;
import java.util.Set;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Where the events of the GenAI Fund calendar on Luma are read (BEY-190). The job runs only where the feed is set.
 * @param feed the calendar's public iCal feed
 * @param hosts the only hosts called: the feed's, the event pages' and their images'
 * @param interval how long the job waits after a read before the next
 * @param timeout how long one call may last, from sending to the last byte
 */
@ConfigurationProperties("beyondpilot.program.luma")
public record LumaProperties(URI feed,
		@DefaultValue({ "luma.com", "api2.luma.com", "images.lumacdn.com" }) Set<String> hosts,
		@DefaultValue("1h") Duration interval, @DefaultValue("10s") Duration timeout) {
}
