package ai.genaifund.beyondpilot.matching;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How a run of matching works ({@code beyondpilot.matching} in application.yaml). The model is what operators chose
 * for the task in Admin › AI.
 * @param candidates how many solutions a run judges
 * @param parallel how many candidates are judged at the same time
 * @param interval how often the worker looks for a run to take
 * @param pause how long a run stops after the provider refused a call
 * @param maxStalls how many times in a row a run may stop without judging anything before it fails
 */
@ConfigurationProperties("beyondpilot.matching")
record MatchingSettings(int candidates, int parallel, Duration interval, Duration pause, int maxStalls) {
}
