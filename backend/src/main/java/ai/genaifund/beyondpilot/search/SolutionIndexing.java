package ai.genaifund.beyondpilot.search;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.organization.OrganizationChanged;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionChanged;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the approved solutions in the index, listed or not: an unlisted one is kept for matching and marked so that no
 * visitor finds it. A change is read again from the solution module, so a late or repeated delivery writes what the
 * solution is now. A change to an organization rewrites its solutions, which show its name.
 */
@Component
class SolutionIndexing {

	private final SolutionDirectory solutions;

	private final SearchDocumentRepository index;

	SolutionIndexing(SolutionDirectory solutions, SearchDocumentRepository index) {
		this.solutions = solutions;
		this.index = index;
	}

	@ApplicationModuleListener
	void on(SolutionChanged changed) {
		UUID id = changed.solutionId();
		solutions.indexed(id)
			.ifPresentOrElse(solution -> index.save(document(solution)),
					() -> index.remove(SearchDocumentRepository.SOLUTION, id));
	}

	/** Writes again what the organization's solutions show of it, and takes them out while it is not approved. */
	@ApplicationModuleListener
	void on(OrganizationChanged changed) {
		List<IndexedSolution> shown = solutions.indexedOf(changed.organizationId());
		shown.forEach(solution -> index.save(document(solution)));
		List<UUID> kept = shown.stream().map(IndexedSolution::id).toList();
		solutions.idsOf(changed.organizationId())
			.stream()
			.filter(id -> !kept.contains(id))
			.forEach(id -> index.remove(SearchDocumentRepository.SOLUTION, id));
	}

	/** Saves every approved solution and takes out every other. */
	Rebuilt rebuild() {
		List<IndexedSolution> approved = solutions.indexedAll();
		approved.forEach(solution -> index.save(document(solution)));
		int removed = index.removeAllExcept(SearchDocumentRepository.SOLUTION,
				approved.stream().map(IndexedSolution::id).toList());
		return new Rebuilt(approved.size(), removed);
	}

	static Document document(IndexedSolution solution) {
		Map<String, Object> facets = new LinkedHashMap<>();
		Cards.put(facets, Cards.ORGANIZATION_SLUG, solution.organizationSlug());
		Cards.put(facets, Cards.COUNTRY, solution.country());
		Cards.put(facets, Cards.MATURITY, solution.maturity());
		Cards.put(facets, Cards.INDUSTRIES, solution.industries());
		Cards.put(facets, Cards.FOCUS_AREAS, solution.focusAreas());
		Cards.put(facets, Cards.PHOTO, solution.logoFileId());
		facets.put(Cards.CUSTOMER_DEPLOYMENTS, solution.customerDeployments());
		String maturity = solution.maturity();
		String keywords = Cards.words(solution.focusAreas(), solution.industries(),
				maturity == null ? List.of() : List.of(maturity), solution.deployment(), solution.builtWith());
		return new Document(SearchDocumentRepository.SOLUTION, solution.id(), solution.slug(), solution.name(),
				solution.organizationName(), Objects.requireNonNullElse(solution.summary(), ""), keywords,
				Cards.lines(solution.name(), solution.organizationName(), keywords, solution.summary(),
						solution.problemsSolved(), solution.valueProposition(), solution.bestCustomerProfile(),
						solution.traction()),
				facets, solution.listed(), null, null);
	}

}
