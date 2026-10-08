package ai.genaifund.beyondpilot.search;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How search embeds its index and its queries ({@code beyondpilot.search.embedding} in application.yaml). The provider,
 * its key and its model are what operators set in Admin › AI › Providers.
 * @param batchSize how many items one request embeds
 * @param interval how often the job looks for items to embed
 * @param minSimilarity the least cosine similarity an item needs to match a query by meaning
 * @param pool how many of the nearest the vector branch takes before ranking
 */
@ConfigurationProperties("beyondpilot.search.embedding")
record EmbeddingSettings(int batchSize, Duration interval, double minSimilarity, int pool) {
}
