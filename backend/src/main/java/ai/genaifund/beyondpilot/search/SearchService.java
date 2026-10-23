package ai.genaifund.beyondpilot.search;

import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.program.ProgramPhase;
import ai.genaifund.beyondpilot.search.dto.SearchCounts;
import ai.genaifund.beyondpilot.search.dto.SearchItem;
import ai.genaifund.beyondpilot.search.dto.SearchPerk;
import ai.genaifund.beyondpilot.search.dto.SearchRequest;
import ai.genaifund.beyondpilot.search.dto.SearchResponse;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Hit;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Meaning;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Search as a visitor uses it: only what is listed, best first, a page at a time. The query is never logged; it is what
 * a person typed.
 */
@Service
public class SearchService {

	static final int PAGE_SIZE = 12;

	/** How many items of each kind the All tab shows; a kind's own tab shows the rest. */
	static final int PER_KIND = 3;

	private final SearchDocumentRepository index;

	private final SearchEmbeddings embeddings;

	SearchService(SearchDocumentRepository index, SearchEmbeddings embeddings) {
		this.index = index;
		this.embeddings = embeddings;
	}

	/**
	 * A page of what matches the request.
	 * @param member whether the reader is signed in, and so reads a use case's budget shown to members only
	 */
	@Transactional(readOnly = true)
	public SearchResponse search(SearchRequest request, boolean member) {
		String query = request.q().strip();
		String kind = request.kind();
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		// By meaning as well as by words, when a model is configured and answers; by words alone otherwise.
		Meaning meaning = embeddings.of(query).orElse(null);
		SearchRequest criteria = query.equals(request.q()) ? request
				: new SearchRequest(query, request.kind(), request.page(), request.size(), request.industry(),
						request.focusArea(), request.maturity(), request.role(), request.type(), request.phase(),
						request.sort(), request.proposalStatus());
		SearchRequest acrossKinds = kind == null ? criteria
				: new SearchRequest(query, null, request.page(), request.size(), request.industry(), request.focusArea(),
						request.maturity(), request.role(), request.type(), request.phase(), request.sort(), request.proposalStatus());
		Map<String, Long> counts = index.counts(acrossKinds, meaning, true);
		if (kind != null) {
			counts.put(kind, index.counts(criteria, meaning, true).getOrDefault(kind, 0L));
		}
		long all = counts.values().stream().mapToLong(Long::longValue).sum();
		Instant now = Instant.now();
		// Every kind at once is the best few of each, the kinds in the order of their best item; one kind is paged.
		List<Hit> hits = kind == null ? index.bestOfEachKind(criteria, meaning, true, PER_KIND)
				: index.page(criteria, meaning, true, member, size, (page - 1) * size);
		List<SearchItem> items = hits.stream()
			.map(hit -> item(hit, now, member))
			.toList();
		return new SearchResponse(
				new SearchCounts(all, counts.getOrDefault(SearchDocumentRepository.PROGRAM, 0L),
						counts.getOrDefault(SearchDocumentRepository.SOLUTION, 0L),
						counts.getOrDefault(SearchDocumentRepository.TALENT, 0L),
						counts.getOrDefault(SearchDocumentRepository.USE_CASE, 0L)),
				items, page, size, kind == null ? all : counts.getOrDefault(kind, 0L));
	}

	/**
	 * What a visitor would find for {@code query} among these kinds, the best first within each, for a caller that
	 * needs only what each item is and where it is: the MCP server's {@code search}.
	 * @param kinds among {@code program}, {@code solution}, {@code talent} and {@code use_case}
	 */
	@Transactional(readOnly = true)
	public List<Found> find(String query, List<String> kinds) {
		return find(query, kinds, true);
	}

	/**
	 * What an operator would find for {@code query} among these kinds: what a visitor finds, and what only matching
	 * may use, such as a solution its owners left unlisted. For the operators' MCP server's {@code search}.
	 */
	@Transactional(readOnly = true)
	public List<Found> findForOperators(String query, List<String> kinds) {
		return find(query, kinds, false);
	}

	/**
	 * The best of each kind side by side: each kind's first, then each kind's second, and so on, since one kind's
	 * scores do not compare with another's. An item whose title is the query comes first, then one whose title holds
	 * it whole, so a program asked for by name is not behind a page of solutions that share its words (BEY-222).
	 */
	private List<Found> find(String query, List<String> kinds, boolean listedOnly) {
		String trimmed = query.strip();
		Meaning meaning = embeddings.of(trimmed).orElse(null);
		String asked = comparable(trimmed);
		record Placed(Found found, int match, int place, int kind) {
		}
		List<Placed> placed = new ArrayList<>();
		for (int kind = 0; kind < kinds.size(); kind++) {
			List<Hit> hits = index.page(SearchRequest.builder(trimmed).kind(kinds.get(kind)).build(), meaning,
					listedOnly, false, PAGE_SIZE, 0);
			for (int place = 0; place < hits.size(); place++) {
				Hit hit = hits.get(place);
				String title = comparable(hit.title());
				int match = title.equals(asked) ? 0 : !asked.isEmpty() && title.contains(asked) ? 1 : 2;
				placed.add(new Placed(new Found(hit.kind(), hit.slug(), hit.title()), match, place, kind));
			}
		}
		return placed.stream()
			.sorted(Comparator.comparingInt(Placed::match)
				.thenComparingInt(Placed::place)
				.thenComparingInt(Placed::kind))
			.map(Placed::found)
			.toList();
	}

	/** Text as a title is compared with the query: without accents or case, words parted by one space. */
	private static String comparable(String text) {
		String plain = Normalizer.normalize(text, Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.replace('đ', 'd')
			.replace('Đ', 'D');
		return plain.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").strip();
	}

	private static SearchItem item(Hit hit, Instant now, boolean member) {
		Map<String, Object> facets = hit.facets();
		// A budget shown to members only is indexed with its amounts, which a visitor is not given.
		boolean hiddenBudget = Boolean.TRUE.equals(bool(facets, Cards.BUDGET_MEMBERS_ONLY)) && !member;
		String phase = SearchDocumentRepository.PROGRAM.equals(hit.kind())
				? ProgramPhase.of(hit.startsOn(), hit.endsOn(), instant(facets, Cards.OPENS_AT),
						instant(facets, Cards.CLOSES_AT), now).code()
				: null;
		return new SearchItem(hit.kind(), hit.slug(), hit.title(), hit.subtitle(), hit.summary(), hit.snippet(),
				text(facets, Cards.TYPE), phase, hit.startsOn(), hit.endsOn(),
				uuid(facets, Cards.COVER), text(facets, Cards.EXTERNAL_URL),
				text(facets, Cards.ORGANIZATION_SLUG), text(facets, Cards.COUNTRY), text(facets, Cards.MATURITY),
				integer(facets, Cards.CUSTOMER_DEPLOYMENTS),
				texts(facets, Cards.INDUSTRIES), texts(facets, Cards.FOCUS_AREAS), texts(facets, Cards.ROLES),
				texts(facets, Cards.SKILLS), text(facets, Cards.CITY), text(facets, Cards.WORKS_AT),
				uuid(facets, Cards.PHOTO), instant(facets, Cards.CLOSES),
				hiddenBudget ? null : whole(facets, Cards.BUDGET_MIN),
				hiddenBudget ? null : whole(facets, Cards.BUDGET_MAX),
				bool(facets, Cards.BUDGET_TO_BE_DETERMINED), text(facets, Cards.CURRENCY),
				bool(facets, Cards.FEATURED), text(facets, Cards.BACKING), integer(facets, Cards.PROJECT_COUNT),
				text(facets, Cards.LEAD_PROJECT_TITLE), text(facets, Cards.LEAD_PROJECT_STAGE),
				bool(facets, Cards.BUDGET_MEMBERS_ONLY), instant(facets, Cards.PUBLISHED_AT),
				texts(facets, Cards.TECHNOLOGIES), integer(facets, Cards.TIMELINE_MIN_WEEKS),
				integer(facets, Cards.TIMELINE_MAX_WEEKS), uuid(facets, Cards.ORGANIZATION_LOGO), perks(facets));
	}

	private static @Nullable String text(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof String value ? value : null;
	}

	private static List<String> texts(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof List<?> values
				? values.stream().filter(String.class::isInstance).map(String.class::cast).toList() : List.of();
	}

	/** The perks of a solution's card; a row written before perks were indexed has none. */
	private static List<SearchPerk> perks(Map<String, Object> facets) {
		if (!(facets.get(Cards.PERKS) instanceof List<?> values)) {
			return List.of();
		}
		return values.stream()
			.filter(Map.class::isInstance)
			.map(value -> (Map<?, ?>) value)
			.filter(perk -> perk.get(Cards.PERK_SLUG) instanceof String && perk.get(Cards.PERK_TITLE) instanceof String)
			.map(perk -> new SearchPerk((String) perk.get(Cards.PERK_SLUG), (String) perk.get(Cards.PERK_TITLE),
					perk.get(Cards.PERK_VALUE) instanceof String value ? value : null,
					Boolean.TRUE.equals(perk.get(Cards.PERK_FROM_GENAI_FUND))))
			.toList();
	}

	private static @Nullable Long whole(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof Number value ? value.longValue() : null;
	}

	private static @Nullable Integer integer(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof Number value ? value.intValue() : null;
	}

	private static @Nullable Boolean bool(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof Boolean value ? value : null;
	}

	private static @Nullable UUID uuid(Map<String, Object> facets, String name) {
		String value = text(facets, name);
		return value == null ? null : UUID.fromString(value);
	}

	private static @Nullable Instant instant(Map<String, Object> facets, String name) {
		String value = text(facets, name);
		return value == null ? null : Instant.parse(value);
	}

}
