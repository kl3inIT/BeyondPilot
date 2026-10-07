package ai.genaifund.beyondpilot.search;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.organization.OrganizationChanged;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import ai.genaifund.beyondpilot.usecase.IndexedUseCase;
import ai.genaifund.beyondpilot.usecase.UseCaseChanged;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the published use cases in the index; any other is taken out. A change is read again from the usecase module,
 * so a late or repeated delivery writes what the use case is now. One past its close date stays in the index and is
 * left out of results by that date. Only what the public list of use cases shows is indexed, its goal and not its
 * problem statement, and the organization's name never for a use case that hides it.
 */
@Component
class UseCaseIndexing {

	private final UseCaseDirectory useCases;

	private final SearchDocumentRepository index;

	UseCaseIndexing(UseCaseDirectory useCases, SearchDocumentRepository index) {
		this.useCases = useCases;
		this.index = index;
	}

	@ApplicationModuleListener
	void on(UseCaseChanged changed) {
		UUID id = changed.useCaseId();
		useCases.indexed(id)
			.ifPresentOrElse(useCase -> index.save(document(useCase)),
					() -> index.remove(SearchDocumentRepository.USE_CASE, id));
	}

	/** Writes again what the organization's use cases show of it, and takes them out while it is not approved. */
	@ApplicationModuleListener
	void on(OrganizationChanged changed) {
		List<IndexedUseCase> shown = useCases.indexedOf(changed.organizationId());
		shown.forEach(useCase -> index.save(document(useCase)));
		List<UUID> kept = shown.stream().map(IndexedUseCase::id).toList();
		useCases.idsOf(changed.organizationId())
			.stream()
			.filter(id -> !kept.contains(id))
			.forEach(id -> index.remove(SearchDocumentRepository.USE_CASE, id));
	}

	/** Saves every published use case and takes out every other. */
	Rebuilt rebuild() {
		List<IndexedUseCase> published = useCases.indexedAll();
		published.forEach(useCase -> index.save(document(useCase)));
		int removed = index.removeAllExcept(SearchDocumentRepository.USE_CASE,
				published.stream().map(IndexedUseCase::id).toList());
		return new Rebuilt(published.size(), removed);
	}

	static Document document(IndexedUseCase useCase) {
		Map<String, Object> facets = new LinkedHashMap<>();
		Cards.put(facets, Cards.INDUSTRIES, useCase.industry() == null ? null : List.of(useCase.industry()));
		Cards.put(facets, Cards.CLOSES, useCase.closesAt());
		Cards.put(facets, Cards.BUDGET_MIN, useCase.budgetMin());
		Cards.put(facets, Cards.BUDGET_MAX, useCase.budgetMax());
		facets.put(Cards.BUDGET_TO_BE_DETERMINED, useCase.budgetToBeDetermined());
		String keywords = Cards.words(useCase.industry() == null ? List.of() : List.of(useCase.industry()),
				useCase.technologies());
		return new Document(SearchDocumentRepository.USE_CASE, useCase.id(), useCase.id().toString(),
				useCase.title(), useCase.organizationName(), Objects.requireNonNullElse(useCase.expectedOutcomes(), ""),
				keywords, Cards.lines(useCase.title(), useCase.organizationName(), keywords, useCase.expectedOutcomes()),
				facets, true, null, null);
	}

}
