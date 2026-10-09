package ai.genaifund.beyondpilot.ai.adapter;

import java.time.Duration;

import ai.genaifund.beyondpilot.ai.ReasoningEffort;
import org.jspecify.annotations.Nullable;

/**
 * How a client asks its model.
 * @param maxOutputTokens the model's own answer limit; null when nobody published one, and then none is sent where
 * the API allows
 * @param reasons whether the model reasons; a level is only sent to one that does
 * @param effort how hard to reason
 * @param timeout how long one call may take
 */
public record ChatModelOptions(@Nullable Integer maxOutputTokens, boolean reasons, ReasoningEffort effort,
		Duration timeout) {
}
