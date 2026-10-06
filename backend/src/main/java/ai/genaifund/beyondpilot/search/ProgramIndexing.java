package ai.genaifund.beyondpilot.search;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.program.IndexedProgram;
import ai.genaifund.beyondpilot.program.ProgramChanged;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the published programs in the index. A change is read again from the program module, so a late or repeated
 * delivery writes what the program is now: a published program is saved, any other is taken out.
 */
@Component
class ProgramIndexing {

	private final ProgramService programs;

	private final SearchDocumentRepository index;

	ProgramIndexing(ProgramService programs, SearchDocumentRepository index) {
		this.programs = programs;
		this.index = index;
	}

	@ApplicationModuleListener
	void on(ProgramChanged changed) {
		UUID id = changed.programId();
		programs.indexed(id)
			.ifPresentOrElse(program -> index.save(document(program)),
					() -> index.remove(SearchDocumentRepository.PROGRAM, id));
	}

	/** Saves every published program and takes out every other. */
	Rebuilt rebuild() {
		List<IndexedProgram> published = programs.indexedAll();
		published.forEach(program -> index.save(document(program)));
		int removed = index.removeAllExcept(SearchDocumentRepository.PROGRAM,
				published.stream().map(IndexedProgram::id).toList());
		return new Rebuilt(published.size(), removed);
	}

	static Document document(IndexedProgram program) {
		Map<String, Object> facets = new LinkedHashMap<>();
		Cards.put(facets, Cards.TYPE, program.type());
		Cards.put(facets, Cards.COVER, program.coverFileId());
		Cards.put(facets, Cards.EXTERNAL_URL, program.externalUrl());
		Cards.put(facets, Cards.OPENS_AT, program.applicationsOpenAt());
		Cards.put(facets, Cards.CLOSES_AT, program.applicationsCloseAt());
		String keywords = Cards.words(List.of(program.type()));
		return new Document(SearchDocumentRepository.PROGRAM, program.id(), program.slug(), program.name(),
				program.partnerName(), Objects.requireNonNullElse(program.summary(), ""), keywords,
				Cards.lines(program.name(), program.partnerName(), keywords, program.summary(), program.about()),
				facets, true, program.startsOn(), program.endsOn());
	}

}
