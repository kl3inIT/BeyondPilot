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
		List<SearchItem> items = index.page(query, kind, true, PAGE_SIZE, (page - 1) * PAGE_SIZE)
			.stream()
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
				? ProgramPhase.of(hit.startsOn(), hit.endsOn(), instant(facets, ProgramIndexing.OPENS_AT),
						instant(facets, ProgramIndexing.CLOSES_AT), now).code()
				: null;
		String cover = text(facets, ProgramIndexing.COVER);
		return new SearchItem(hit.kind(), hit.slug(), hit.title(), hit.subtitle(), hit.summary(),
				text(facets, ProgramIndexing.TYPE), phase, hit.startsOn(), hit.endsOn(),
				cover == null ? null : UUID.fromString(cover), text(facets, ProgramIndexing.EXTERNAL_URL));
	}

	private static @Nullable String text(Map<String, Object> facets, String name) {
		return facets.get(name) instanceof String value ? value : null;
	}

	private static @Nullable Instant instant(Map<String, Object> facets, String name) {
		String value = text(facets, name);
		return value == null ? null : Instant.parse(value);
	}

}
