package ai.genaifund.beyondpilot.search;

import java.time.Duration;

import com.openai.errors.BadRequestException;
import com.openai.errors.NotFoundException;
import com.openai.errors.PermissionDeniedException;
import com.openai.errors.UnauthorizedException;
import com.openai.errors.UnprocessableEntityException;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.MetadataMode;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.stereotype.Component;

/**
 * Connects to a provider that speaks the OpenAI API, and tries a connection by embedding one sentence, the way
 * MemoryOS probes an embedding provider before it is used.
 */
@Component
class OpenAiEmbeddings {

	private static final Logger LOG = LoggerFactory.getLogger(OpenAiEmbeddings.class);

	/** A query waits for its embedding; search answers by keywords rather than wait longer. */
	private static final Duration TIMEOUT = Duration.ofSeconds(5);

	/** The sentence a test embeds. */
	private static final String PROBE = "BeyondPilot connects AI solutions with the businesses that need them.";

	/** A client for one provider, key and model; nothing is sent until it embeds. */
	EmbeddingModel connect(String baseUrl, String apiKey, String model) {
		OpenAiEmbeddingOptions options = OpenAiEmbeddingOptions.builder()
			.dimensions(EmbeddingVendor.DIMENSIONS)
			.model(model)
			.baseUrl(baseUrl)
			.apiKey(apiKey)
			.timeout(TIMEOUT)
			.maxRetries(1)
			.build();
		return OpenAiEmbeddingModel.builder().options(options).metadataMode(MetadataMode.NONE).build();
	}

	/**
	 * Embeds one sentence with this provider, key and model.
	 * @return whether it worked and how long it took; a failure is named by its kind, never by the provider's message,
	 * which can repeat the request
	 */
	Probe probe(String baseUrl, String apiKey, String model) {
		long started = System.nanoTime();
		try {
			float[] vector = connect(baseUrl, apiKey, model).embed(PROBE);
			long millis = (System.nanoTime() - started) / 1_000_000;
			if (vector.length != EmbeddingVendor.DIMENSIONS) {
				return new Probe(false, model, vector.length, millis, Probe.WRONG_DIMENSIONS);
			}
			return new Probe(true, model, vector.length, millis, null);
		}
		catch (RuntimeException failure) {
			long millis = (System.nanoTime() - started) / 1_000_000;
			String reason = reason(failure);
			LOG.atInfo()
				.addKeyValue("event", "search.provider.probe_failed")
				.addKeyValue("error_type", failure.getClass().getName())
				.addKeyValue("error_code", reason)
				.log("An embedding provider did not embed the test sentence");
			return new Probe(false, model, null, millis, reason);
		}
	}

	/** The kind of a provider failure, in the words the screens use. */
	static String reason(RuntimeException failure) {
		if (failure instanceof UnauthorizedException || failure instanceof PermissionDeniedException) {
			return Probe.REJECTED;
		}
		if (failure instanceof BadRequestException || failure instanceof NotFoundException
				|| failure instanceof UnprocessableEntityException) {
			return Probe.MODEL_REFUSED;
		}
		return Probe.UNREACHABLE;
	}

	/**
	 * What a test of a connection found.
	 * @param reason {@code rejected} (the key), {@code model_refused}, {@code unreachable} or {@code wrong_dimensions};
	 * null when it worked
	 */
	record Probe(boolean ok, String model, @Nullable Integer dimensions, long latencyMs, @Nullable String reason) {

		static final String REJECTED = "rejected";

		static final String MODEL_REFUSED = "model_refused";

		static final String UNREACHABLE = "unreachable";

		static final String WRONG_DIMENSIONS = "wrong_dimensions";

	}

}
