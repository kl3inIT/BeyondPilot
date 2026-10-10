package ai.genaifund.beyondpilot.matching;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How the worker of matching works ({@code beyondpilot.matching} in application.yaml). The model is what operators
 * chose for the task in Admin › AI, and the limits of matching are what they set there too: how many candidates
 * are judged at the same time is one of them.
 * @param interval how often the worker looks for a run to take
 * @param pause how long a run stops after the provider refused a call
 * @param maxStalls how many times in a row a run may stop without judging anything before it fails
 */
@ConfigurationProperties("beyondpilot.matching")
record MatchingSettings(Duration interval, Duration pause, int maxStalls) {
}
