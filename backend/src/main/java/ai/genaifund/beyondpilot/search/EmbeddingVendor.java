package ai.genaifund.beyondpilot.search;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * The providers an operator may connect for embeddings. Both speak the OpenAI API and differ by address, by bill and
 * by how they name a model; each offers models that give the 1,536 dimensions the index stores.
 */
enum EmbeddingVendor {

	OPENAI("openai", "https://api.openai.com/v1", List.of("text-embedding-3-large", "text-embedding-3-small")),

	OPENROUTER("openrouter", "https://openrouter.ai/api/v1",
			List.of("openai/text-embedding-3-large", "openai/text-embedding-3-small"));

	/** The length of every vector in the index ({@code vector(1536)}). */
	static final int DIMENSIONS = 1536;

	private final String id;

	private final String baseUrl;

	private final List<String> models;

	EmbeddingVendor(String id, String baseUrl, List<String> models) {
		this.id = id;
		this.baseUrl = baseUrl;
		this.models = models;
	}

	static Optional<EmbeddingVendor> of(String id) {
		return Arrays.stream(values()).filter(vendor -> vendor.id.equals(id)).findFirst();
	}

	String id() {
		return id;
	}

	String baseUrl() {
		return baseUrl;
	}

	List<String> models() {
		return models;
	}

}
