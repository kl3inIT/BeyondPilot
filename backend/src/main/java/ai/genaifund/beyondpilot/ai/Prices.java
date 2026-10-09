package ai.genaifund.beyondpilot.ai;

import java.math.BigDecimal;

import ai.genaifund.beyondpilot.ai.persistence.AiModel;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * What a call is charged at. A price an operator set on a model or an OCR provider is theirs; where they set none, the
 * price is the catalog's, read each time, so a corrected catalog reaches every row that follows it from the next
 * deploy and never overwrites a price somebody typed. A price saved equal to the catalog's is kept as none, so that
 * it goes on following.
 */
@Component
class Prices {

	private final KnownModels models;

	private final KnownServices services;

	Prices(KnownModels models, KnownServices services) {
		this.models = models;
		this.services = services;
	}

	/** The prices of a model: its own where an operator set them, else the catalog's for its name. */
	OfModel of(AiModel model) {
		if (model.getInputPrice() != null || model.getOutputPrice() != null || model.getCachedInputPrice() != null) {
			return new OfModel(model.getInputPrice(), model.getOutputPrice(), model.getCachedInputPrice(), false);
		}
		return catalog(model.getModelName());
	}

	/**
	 * The prices to keep on a model's row for what an operator saved: none when they are the catalog's, so the model
	 * follows it; their own otherwise.
	 */
	OfModel toKeep(String modelName, @Nullable BigDecimal input, @Nullable BigDecimal output,
			@Nullable BigDecimal cachedInput) {
		OfModel listed = catalog(modelName);
		boolean none = input == null && output == null && cachedInput == null;
		boolean asListed = listed.fromCatalog() && same(input, listed.input()) && same(output, listed.output())
				&& same(cachedInput, listed.cachedInput());
		return none || asListed ? new OfModel(null, null, null, listed.fromCatalog())
				: new OfModel(input, output, cachedInput, false);
	}

	/** What 1,000 calls to an OCR provider cost: its own price where an operator set one, else the catalog's. */
	OfCalls ofOcr(String adapterType, @Nullable BigDecimal own) {
		if (own != null) {
			return new OfCalls(own, false);
		}
		BigDecimal listed = services.ocrPricePerThousandCalls(adapterType).orElse(null);
		return new OfCalls(listed, listed != null);
	}

	/** The price to keep on an OCR provider's row: none when it is the catalog's, so the provider follows it. */
	@Nullable BigDecimal ocrToKeep(String adapterType, @Nullable BigDecimal typed) {
		BigDecimal listed = services.ocrPricePerThousandCalls(adapterType).orElse(null);
		return typed != null && listed != null && typed.compareTo(listed) == 0 ? null : typed;
	}

	private OfModel catalog(String modelName) {
		return models.find(modelName)
			.filter(known -> known.inputPrice() != null || known.outputPrice() != null)
			.map(known -> new OfModel(known.inputPrice(), known.outputPrice(), known.cachedInputPrice(), true))
			.orElse(new OfModel(null, null, null, false));
	}

	private static boolean same(@Nullable BigDecimal one, @Nullable BigDecimal other) {
		return one == null ? other == null : other != null && one.compareTo(other) == 0;
	}

	/**
	 * A model's prices, in US dollars per million tokens; null where nobody knows one.
	 * @param fromCatalog whether they are the catalog's rather than an operator's
	 */
	record OfModel(@Nullable BigDecimal input, @Nullable BigDecimal output, @Nullable BigDecimal cachedInput,
			boolean fromCatalog) {
	}

	/**
	 * What 1,000 calls cost, in US dollars; null where nobody knows.
	 * @param fromCatalog whether it is the catalog's rather than an operator's
	 */
	record OfCalls(@Nullable BigDecimal perThousand, boolean fromCatalog) {
	}

}
