package ai.genaifund.beyondpilot.ai.adapter;

import java.math.BigDecimal;

import org.jspecify.annotations.Nullable;

/**
 * A model as its provider lists it. Whatever the provider does not publish is null and is never guessed here.
 * @param pricing US dollars per million tokens
 */
public record ReportedModel(String modelName, @Nullable Integer contextWindow, @Nullable Integer maxOutputTokens,
		@Nullable Boolean toolCalling, @Nullable Boolean vision, @Nullable Boolean reasoning,
		@Nullable Pricing pricing) {

	/** @param cachedInput the price of input read from the provider's cache, where it has one */
	public record Pricing(BigDecimal input, BigDecimal output, @Nullable BigDecimal cachedInput) {
	}

}
