package ai.genaifund.beyondpilot.search;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Meaning;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What the index holds of the solutions' own material, for matching: which solutions answer a set of queries, and what
 * one solution's deck, website and customer cases say. Unlisted solutions are found too; no visitor reads this.
 */
@Service
public class SolutionEvidence {

	/** How many solutions each query gives before the queries are fused. */
	private static final int POOL = 100;

	private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]+");

	/** Words every text holds, which would make every passage match. */
	private static final Set<String> COMMON = Set.of("a", "an", "the", "of", "on", "in", "at", "to", "for", "and", "or",
			"with", "as", "by", "is", "was", "were", "be", "been", "are", "this", "that", "it", "its", "from", "into",
			"using", "used", "use", "via", "per", "our", "we", "you", "your", "their", "they", "has", "have", "had",
			"can", "will", "which", "such", "each", "any", "all", "not", "than", "then", "them", "these", "those");

	private final SearchPassageRepository passages;

	private final SearchEmbeddings embeddings;

	private final SearchDocumentRepository index;

	SolutionEvidence(SearchPassageRepository passages, SearchEmbeddings embeddings, SearchDocumentRepository index) {
		this.passages = passages;
		this.embeddings = embeddings;
		this.index = index;
	}

	/**
	 * A solution as a candidate is shown.
	 * @param listed false when its owners keep it out of the directory, so it has no public page
	 */
	public record Shown(String slug, String name, @Nullable String organizationName, boolean listed) {
	}

	/** How these solutions are shown, by identifier; one that is no longer in the index is left out. */
	@Transactional(readOnly = true)
	public Map<UUID, Shown> shown(Collection<UUID> solutionIds) {
		Map<UUID, Shown> shown = new LinkedHashMap<>();
		index.named(SearchDocumentRepository.SOLUTION, solutionIds)
			.forEach((id, named) -> shown.put(id,
					new Shown(named.slug(), named.title(), named.subtitle(), named.listed())));
		return shown;
	}

	/**
	 * One passage of a solution's material.
	 * @param source {@code deck}, {@code website} or {@code customer_case}
	 * @param page the page of the deck, the place of the web page among the site's, or the place of the customer case
	 * @param part the place of the passage on its page, from 0
	 * @param locator the address of the web page; null for the other sources
	 * @param byModel whether a model read the passage from the picture of its page
	 */
	public record Passage(String source, int page, int part, @Nullable String locator,
			String text, boolean byModel) {
	}

	/**
	 * The solutions that answer these queries best, the best first: each query is searched by its words and by its
	 * meaning, over the profiles and over the passages, and the queries are fused by adding their scores, so a
	 * solution several queries find comes before one that a single query finds. By words alone while no embedding
	 * model answers.
	 */
	@Transactional(readOnly = true)
	public List<UUID> solutionsFor(List<String> queries, int limit) {
		Map<UUID, Double> scores = new LinkedHashMap<>();
		for (String query : queries) {
			String terms = terms(query);
			if (terms.isEmpty()) {
				continue;
			}
			Meaning meaning = embeddings.of(query).orElse(null);
			passages.solutions(terms, meaning, POOL).forEach((solution, score) -> scores.merge(solution, score, Double::sum));
		}
		return scores.entrySet()
			.stream()
			.sorted(Map.Entry.<UUID, Double>comparingByValue(Comparator.reverseOrder())
				.thenComparing(Map.Entry.<UUID, Double>comparingByKey()))
			.limit(limit)
			.map(Map.Entry::getKey)
			.toList();
	}

	/** What a solution's customer cases, deck and website say, in that order, without the pages nothing has read. */
	@Transactional(readOnly = true)
	public List<Passage> passagesOf(UUID solutionId) {
		return passages.of(solutionId)
			.stream()
			.filter(passage -> !passage.text().isBlank())
			.map(passage -> new Passage(passage.source(), passage.page(), passage.part(), passage.locator(),
					passage.text(), SearchPassageRepository.READ_BY_MODEL.equals(passage.reading())))
			.toList();
	}

	/** The words of a query that tell passages apart, joined so that a passage with some of them matches. */
	static String terms(String query) {
		Set<String> words = new LinkedHashSet<>();
		Matcher matcher = WORD.matcher(query.toLowerCase(Locale.ROOT));
		while (matcher.find()) {
			String word = matcher.group();
			if (word.length() > 1 && !COMMON.contains(word)) {
				words.add(word);
			}
		}
		return String.join(" | ", words);
	}

}
