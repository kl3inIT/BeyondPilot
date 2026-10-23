package ai.genaifund.beyondpilot.search;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.organization.OrganizationChanged;
import ai.genaifund.beyondpilot.perk.PerkCatalog;
import ai.genaifund.beyondpilot.perk.PerkChanged;
import ai.genaifund.beyondpilot.perk.PerkLine;
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
 * solution is now. A change to an organization rewrites its solutions, which show its name, and a change to a perk
 * rewrites the solutions it goes with, whose cards show it.
 */
@Component
class SolutionIndexing {

	private final SolutionDirectory solutions;

	private final SearchDocumentRepository index;

	private final IndexLock lock;

	private final SolutionPassages passages;

	private final PerkCatalog perks;

	SolutionIndexing(SolutionDirectory solutions, SearchDocumentRepository index, SolutionPassages passages,
			IndexLock lock, PerkCatalog perks) {
		this.lock = lock;
		this.perks = perks;
		this.solutions = solutions;
		this.index = index;
		this.passages = passages;
	}

	@ApplicationModuleListener
	void on(SolutionChanged changed) {
		lock.run(() -> {
			UUID id = changed.solutionId();
			solutions.indexed(id).ifPresentOrElse(solution -> {
				save(List.of(solution));
				// Its deck is read by the job, which finds a new file by itself.
				passages.casesOf(id, solution.name());
			}, () -> {
				index.remove(SearchDocumentRepository.SOLUTION, id);
				passages.forget(id);
			});
		});
	}

	/** Writes again what the organization's solutions show of it, and takes them out while it is taken down. */
	@ApplicationModuleListener
	void on(OrganizationChanged changed) {
		lock.run(() -> {
			List<IndexedSolution> shown = solutions.indexedOf(changed.organizationId());
			save(shown);
			List<UUID> kept = shown.stream().map(IndexedSolution::id).toList();
			solutions.idsOf(changed.organizationId())
				.stream()
				.filter(id -> !kept.contains(id))
				.forEach(id -> index.remove(SearchDocumentRepository.SOLUTION, id));
		});
	}

	/** Writes again the cards of the solutions a perk went with or goes with, which show the perks open now. */
	@ApplicationModuleListener
	void on(PerkChanged changed) {
		lock.run(() -> save(changed.solutionIds()
			.stream()
			.map(solutions::indexed)
			.flatMap(Optional::stream)
			.toList()));
	}

	/** Saves every approved solution and takes out every other. */
	Rebuilt rebuild() {
		List<IndexedSolution> approved = solutions.indexedAll();
		save(approved);
		approved.forEach(solution -> passages.casesOf(solution.id(), solution.name()));
		int removed = index.removeAllExcept(SearchDocumentRepository.SOLUTION,
				approved.stream().map(IndexedSolution::id).toList());
		return new Rebuilt(approved.size(), removed);
	}

	private void save(List<IndexedSolution> shown) {
		Map<UUID, List<PerkLine>> lines = perks.lines(shown.stream().map(IndexedSolution::id).toList());
		shown.forEach(solution -> index.save(document(solution, lines.getOrDefault(solution.id(), List.of()))));
	}

	static Document document(IndexedSolution solution, List<PerkLine> perks) {
		Map<String, Object> facets = new LinkedHashMap<>();
		Cards.put(facets, Cards.ORGANIZATION_SLUG, solution.organizationSlug());
		Cards.put(facets, Cards.COUNTRY, solution.country());
		Cards.put(facets, Cards.MATURITY, solution.maturity());
		Cards.put(facets, Cards.INDUSTRIES, solution.industries());
		Cards.put(facets, Cards.FOCUS_AREAS, solution.focusAreas());
		Cards.put(facets, Cards.PHOTO, solution.logoFileId());
		facets.put(Cards.CUSTOMER_DEPLOYMENTS, solution.customerDeployments());
		Cards.put(facets, Cards.PUBLISHED_AT, solution.publishedAt());
		Cards.put(facets, Cards.COVER, solution.coverFileId());
		Cards.put(facets, Cards.BACKING, solution.backing());
		facets.put(Cards.FEATURED, solution.featured());
		Cards.put(facets, Cards.PERKS, perks.stream().map(perk -> {
			Map<String, Object> line = new LinkedHashMap<>();
			line.put(Cards.PERK_SLUG, perk.slug());
			line.put(Cards.PERK_TITLE, perk.title());
			Cards.put(line, Cards.PERK_VALUE, perk.value());
			line.put(Cards.PERK_FROM_GENAI_FUND, perk.fromGenAiFund());
			return line;
		}).toList());
		String maturity = solution.maturity();
		String keywords = Cards.words(solution.focusAreas(), solution.industries(),
				maturity == null ? List.of() : List.of(maturity), solution.deployment(), solution.builtWith());
		return new Document(SearchDocumentRepository.SOLUTION, solution.id(), solution.slug(), solution.name(),
				solution.organizationName(), Objects.requireNonNullElse(solution.summary(), ""), keywords,
				Cards.lines(solution.name(), solution.organizationName(), keywords, solution.summary(),
						solution.problemsSolved(), solution.valueProposition(), solution.bestCustomerProfile(),
						solution.traction(),
						// A search for a perk finds the solutions it goes with.
						perks.stream().map(PerkLine::title).collect(Collectors.joining("\n"))),
				facets, solution.listed(), null, null);
	}

}
