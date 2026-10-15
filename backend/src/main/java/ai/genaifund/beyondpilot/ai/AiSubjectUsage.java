package ai.genaifund.beyondpilot.ai;

import java.math.BigDecimal;

import org.jspecify.annotations.Nullable;

/**
 * What the calls about one {@link AiSubject} came to, for the module that named the subject.
 * @param inputTokens every input token, those read from and written to the provider's cache included
 * @param cost the estimated cost in US dollars of the calls with a known price; null when none has one
 * @param unpriced how many calls answered without a known price, which the cost leaves out
 */
public record AiSubjectUsage(long calls, long failed, long inputTokens, long outputTokens, long cacheReadTokens,
		long cacheWriteTokens, @Nullable BigDecimal cost, long unpriced) {
}
