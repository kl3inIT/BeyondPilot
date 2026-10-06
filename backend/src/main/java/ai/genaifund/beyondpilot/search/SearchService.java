package ai.genaifund.beyondpilot.search;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.program.ProgramPhase;
import ai.genaifund.beyondpilot.search.dto.SearchCounts;
import ai.genaifund.beyondpilot.search.dto.SearchItem;
import ai.genaifund.beyondpilot.search.dto.SearchRequest;
import ai.genaifund.beyondpilot.search.dto.SearchResponse;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Hit;
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

	SearchService(SearchDocumentRepository index) {
		this.index = index;
	}

	@Transactional(readOnly = true)
	public SearchResponse search(SearchRequest request) {
		String query = request.q().strip();
		String kind = request.kind();
		int page = request.page() == null ? 1 : request.page();
		Map<String, Long> counts = index.counts(query, true);
		long all = counts.values().stream().mapToLong(Long::longValue).sum();
		Instant now = Instant.now();
		// Every kind at once is the best few of each, the kinds in the order of their best item; one kind is paged.
		List<Hit> hits = kind == null ? index.bestOfEachKind(query, true, PER_KIND)
				: index.page(query, kind, true, PAGE_SIZE, (page - 1) * PAGE_SIZE);
		List<SearchItem> items = hits.stream()
			.map(hit -> item(hit, now))
			.toList();
		return new SearchResponse(
				new SearchCounts(all, counts.getOrDefault(SearchDocumentRepository.PROGRAM, 0L),
						counts.getOrDefault(SearchDocumentRepository.SOLUTION, 0L),
						counts.getOrDefault(SearchDocumentRepository.TALENT, 0L)),
				items, page, PAGE_SIZE, kind == null ? all : counts.getOrDefault(kind, 0L));
	}

	private static SearchItem item(Hit hit, Instant now) {
		Map<String, Object> facets = hit.facets();
		String phase = SearchDocumentRepository.PROGRAM.equals(hit.kind())
				? ProgramPhase.of(hit.startsOn(), hit.endsOn(), instant(facets, Cards.OPENS_AT),
						instant(facets, Cards.CLOSES_AT), now).code()
				: null;
		return new SearchItem(hit.kind(), hit.slug(), hit.title(), hit.subtitle(), hit.summary(), hit.snippet(),
				text(facets, Cards.TYPE), phase, hit.startsOn(), hit.endsOn(),
				uuid(facets, Cards.COVER), text(facets, Cards.EXTERNAL_URL),
				text(facets, Cards.ORGANIZATION_SLUG), text(facets, Cards.COUNTRY), text(facets, Cards.MATURITY),
				facets.get(Cards.CUSTOMER_DEPLOYMENTS) instanceof Number count ? count.intValue() : null,
				texts(facets, Cards.INDUSTRIES), texts(facets, Cards.FOCUS_AREAS), texts(facets, Cards.ROLES),
				texts(facets, Cards.SKILLS), text(facets, Cards.CITY), text(facets, Cards.WORKS_AT),
				uuid(facets, Cards.PHOTO));
	}

	private static @Nullable String text(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof String value ? value : null;
	}

	private static List<String> texts(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof List<?> values
				? values.stream().filter(String.class::isInstance).map(String.class::cast).toList() : List.of();
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
