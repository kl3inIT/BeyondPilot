package ai.genaifund.beyondpilot.search;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.program.IndexedProgram;
import ai.genaifund.beyondpilot.program.ProgramChanged;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import org.jspecify.annotations.Nullable;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the published programs in the index. A change is read again from the program module, so a late or repeated
 * delivery writes what the program is now: a published program is saved, any other is taken out.
 */
@Component
class ProgramIndexing {

	static final String TYPE = "type";

	static final String COVER = "coverFileId";

	static final String EXTERNAL_URL = "externalUrl";

	static final String OPENS_AT = "applicationsOpenAt";

	static final String CLOSES_AT = "applicationsCloseAt";

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

	/** What a rebuild did: the items it saved, and the rows it took out because their item is no longer published. */
	record Rebuilt(int saved, int removed) {
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
		facets.put(TYPE, program.type());
		put(facets, COVER, program.coverFileId());
		put(facets, EXTERNAL_URL, program.externalUrl());
		put(facets, OPENS_AT, program.applicationsOpenAt());
		put(facets, CLOSES_AT, program.applicationsCloseAt());
		String keywords = program.type().replace('_', ' ');
		return new Document(SearchDocumentRepository.PROGRAM, program.id(), program.slug(), program.name(),
				program.partnerName(), Objects.requireNonNullElse(program.summary(), ""), keywords,
				lines(program.name(), program.partnerName(), keywords, program.summary(), program.about()), facets,
				true, program.startsOn(), program.endsOn());
	}

	private static void put(Map<String, Object> facets, String name, @Nullable Object value) {
		if (value != null) {
			facets.put(name, value instanceof Instant || value instanceof UUID ? value.toString() : value);
		}
	}

	/** The card: each piece a person reads on the page, one per line. */
	private static String lines(@Nullable String... pieces) {
		return Stream.of(pieces).filter(Objects::nonNull).collect(Collectors.joining("\n"));
	}

}
