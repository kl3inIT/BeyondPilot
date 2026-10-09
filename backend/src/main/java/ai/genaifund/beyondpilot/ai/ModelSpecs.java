package ai.genaifund.beyondpilot.ai;

import ai.genaifund.beyondpilot.ai.KnownModels.Known;
import ai.genaifund.beyondpilot.ai.adapter.ReportedModel;
import org.jspecify.annotations.Nullable;

/**
 * Puts together what a provider lists about a model and what the catalog knows, as MemoryOS's
 * {@code ModelResolver.spec} does: the provider's own value first, then the catalog, otherwise unknown.
 */
final class ModelSpecs {

	/** A model nobody describes is taken to hold 32,000 tokens, as Onyx and MemoryOS assume. */
	static final int FALLBACK_CONTEXT_WINDOW = 32_000;

	private ModelSpecs() {
	}

	static Spec of(ReportedModel reported, @Nullable Known known) {
		Integer context = valid(reported.contextWindow());
		boolean fromProvider = context != null;
		if (context == null && known != null) {
			context = known.contextWindow();
		}
		if (context == null) {
			context = FALLBACK_CONTEXT_WINDOW;
		}
		// A router can list a larger window than the route accepts; when both know the model, the smaller holds.
		else if (known != null && known.contextWindow() < context) {
			context = known.contextWindow();
		}
		Integer output = reported.maxOutputTokens();
		if (output == null || output < 1 || output >= context) {
			output = known != null && known.maxOutputTokens() < context ? Integer.valueOf(known.maxOutputTokens()) : null;
		}
		// An unknown model is taken to call tools; vision and reasoning are declared only when published, since
		// declaring them changes what a request carries.
		boolean tools = first(reported.toolCalling(), known == null ? null : known.toolCalling(), true);
		boolean vision = first(reported.vision(), known == null ? null : known.vision(), false);
		boolean reasoning = first(reported.reasoning(), known == null ? null : known.reasoning(), false);
		ReportedModel.Pricing pricing = reported.pricing() != null ? reported.pricing()
				: known == null ? null : known.pricing();
		String source = fromProvider ? "provider" : known != null ? "catalog" : "none";
		return new Spec(reported.modelName(), context, output, tools, vision, reasoning, pricing, source);
	}

	private static @Nullable Integer valid(@Nullable Integer value) {
		return value != null && value >= 256 && value <= 10_000_000 ? value : null;
	}

	private static boolean first(@Nullable Boolean reported, @Nullable Boolean known, boolean otherwise) {
		return reported != null ? reported : known != null ? known : otherwise;
	}

	/** @param source where the context window came from: {@code provider}, {@code catalog} or {@code none} */
	record Spec(String modelName, int contextWindow, @Nullable Integer maxOutputTokens, boolean toolCalling,
			boolean vision, boolean reasoning, ReportedModel.@Nullable Pricing pricing, String source) {
	}

}
