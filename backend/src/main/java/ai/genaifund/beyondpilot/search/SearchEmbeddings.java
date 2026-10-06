package ai.genaifund.beyondpilot.search;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Meaning;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Pending;
import com.openai.errors.BadRequestException;
import com.openai.errors.UnprocessableEntityException;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The meaning of the index and of each query, from the embedding model a deployment configures; without one, search
 * goes by words alone. The job embeds what changed in batches. When the provider fails, the job and the queries pause
 * with a longer wait each time, so an outage costs no row and slows no search (the way Discourse pauses a model rather
 * than its rows); an item the provider refuses for what it holds is held back alone.
 */
@Component
@EnableConfigurationProperties(EmbeddingSettings.class)
class SearchEmbeddings {

	private static final Logger LOG = LoggerFactory.getLogger(SearchEmbeddings.class);

	/** The waits after consecutive failures of the provider. */
	private static final List<Duration> PAUSES = List.of(Duration.ofSeconds(30), Duration.ofMinutes(3),
			Duration.ofMinutes(20), Duration.ofHours(1), Duration.ofHours(6));

	/** How many query vectors are kept: about 6 MB at 1,536 dimensions. */
	private static final int RECENT_QUERIES = 1000;

	/** The longest card the model is sent; a card is far shorter, so this only guards against a runaway text. */
	private static final int MAX_CHARACTERS = 8000;

	private final ObjectProvider<EmbeddingModel> models;

	private final SearchDocumentRepository index;

	private final EmbeddingSettings settings;

	private final String model;

	/** The vectors of the latest queries, the least recently asked dropped first. */
	private final Map<String, float[]> recent = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
		@Override
		protected boolean removeEldestEntry(Map.Entry<String, float[]> eldest) {
			return size() > RECENT_QUERIES;
		}
	});

	// Read by searches and written by the job; a lost update only shortens or lengthens one pause.
	private volatile Instant pausedUntil = Instant.MIN;

	private volatile int failures;

	SearchEmbeddings(ObjectProvider<EmbeddingModel> models, SearchDocumentRepository index, EmbeddingSettings settings,
			@Value("${spring.ai.openai.embedding.model}") String model) {
		this.models = models;
		this.index = index;
		this.settings = settings;
		this.model = model;
	}

	/**
	 * The query's meaning to search by, or empty when there is no model, the provider is paused, or it failed now; the
	 * search then goes by words alone. Anyone can search, so a query only pauses the provider when the provider failed:
	 * a query it refuses for what it holds fails alone, and a visitor cannot switch search by meaning off for everyone.
	 * A query asked again is answered from the recent ones without a call.
	 */
	Optional<Meaning> of(String query) {
		EmbeddingModel embeddings = available();
		if (embeddings == null) {
			return Optional.empty();
		}
		String key = query.strip().toLowerCase(Locale.ROOT);
		float[] vector = recent.get(key);
		if (vector == null) {
			try {
				vector = embeddings.embed(query);
				recent.put(key, vector);
				succeeded();
			}
			catch (RuntimeException failure) {
				if (refused(failure)) {
					LOG.atInfo()
						.addKeyValue("event", "search.query_embedding.refused")
						.addKeyValue("error_type", failure.getClass().getName())
						.log("The embedding provider refused a query; it is searched by words");
				}
				else {
					failed("search.query_embedding.failed", failure);
				}
				return Optional.empty();
			}
		}
		return Optional.of(new Meaning(model, vector, settings.minSimilarity(), settings.pool()));
	}

	/** Embeds the next batch of items whose vector is missing, stale or of another model. */
	@Scheduled(fixedDelayString = "${beyondpilot.search.embedding.interval}", initialDelay = 30_000)
	void embedPending() {
		EmbeddingModel embeddings = available();
		if (embeddings == null) {
			return;
		}
		List<Pending> batch = index.pendingEmbeddings(model, settings.batchSize());
		if (batch.isEmpty()) {
			return;
		}
		try {
			List<float[]> vectors = embeddings.embed(batch.stream().map(SearchEmbeddings::text).toList());
			int kept = 0;
			for (int i = 0; i < batch.size(); i++) {
				kept += index.saveEmbedding(batch.get(i), model, vectors.get(i)) ? 1 : 0;
			}
			succeeded();
			LOG.atInfo()
				.addKeyValue("event", "search.embedding.batch_embedded")
				.addKeyValue("items", batch.size())
				.addKeyValue("kept", kept)
				.log("A batch of the search index was embedded");
		}
		catch (RuntimeException failure) {
			if (refused(failure)) {
				embedOneByOne(embeddings, batch);
			}
			else {
				failed("search.embedding.provider_failed", failure);
			}
		}
	}

	/**
	 * After the provider refused a batch for what it holds: each item alone, and an item it refuses again is held back.
	 * A failure of another kind on the way pauses the provider and holds back nothing more.
	 */
	private void embedOneByOne(EmbeddingModel embeddings, List<Pending> batch) {
		for (Pending item : batch) {
			try {
				index.saveEmbedding(item, model, embeddings.embed(text(item)));
			}
			catch (RuntimeException failure) {
				if (!refused(failure)) {
					failed("search.embedding.provider_failed", failure);
					return;
				}
				index.deferEmbedding(item, failure.getClass().getSimpleName());
			}
		}
		succeeded();
	}

	/**
	 * Whether the provider refused what it was sent (400 or 422), which another item would not hit; an outage, a timeout,
	 * a rate limit or a wrong key is the provider's.
	 */
	private static boolean refused(RuntimeException failure) {
		return failure instanceof BadRequestException || failure instanceof UnprocessableEntityException;
	}

	private @Nullable EmbeddingModel available() {
		EmbeddingModel embeddings = models.getIfAvailable();
		return embeddings == null || Instant.now().isBefore(pausedUntil) ? null : embeddings;
	}

	private void succeeded() {
		failures = 0;
		pausedUntil = Instant.MIN;
	}

	private void failed(String event, RuntimeException failure) {
		Duration pause = PAUSES.get(Math.min(failures, PAUSES.size() - 1));
		failures++;
		pausedUntil = Instant.now().plus(pause);
		// The provider's message can repeat the request; only the kind of failure is logged.
		LOG.atWarn()
			.addKeyValue("event", event)
			.addKeyValue("error_type", failure.getClass().getName())
			.addKeyValue("pause_seconds", pause.toSeconds())
			.log("The embedding provider failed; search goes by words until it answers");
	}

	private static String text(Pending item) {
		return item.card().length() <= MAX_CHARACTERS ? item.card() : item.card().substring(0, MAX_CHARACTERS);
	}

}
