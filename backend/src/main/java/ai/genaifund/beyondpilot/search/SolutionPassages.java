package ai.genaifund.beyondpilot.search;

import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.CUSTOMER_CASE;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.DECK;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.READ_AS_TEXT;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.UNREAD;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.ai.AiException;
import ai.genaifund.beyondpilot.ai.AiSubject;
import ai.genaifund.beyondpilot.ai.DocumentPages;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.Passage;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.UnreadDeck;
import ai.genaifund.beyondpilot.solution.CustomerCase;
import ai.genaifund.beyondpilot.solution.SolutionDeck;
import ai.genaifund.beyondpilot.solution.SolutionDeckFile;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Keeps the passages of what a solution's own material says: its customer cases, written again whenever the solution
 * changes, and its deck, read in the background a few decks at a time, since reading a file is slow and a solution
 * must be found by its profile meanwhile. A source is replaced only when what it was made from changed, so a passage
 * keeps its vector until then. The website's passages are loaded (infrastructure/legacy-import/passages.py) until
 * BEY-99 reads websites.
 */
@Component
class SolutionPassages {

	private static final Logger LOG = LoggerFactory.getLogger(SolutionPassages.class);

	/** A deck is read to here: the longest imported one has 169 pages, the median 15. */
	static final int DECK_PAGES = 80;

	/** How many decks one run reads; a run a minute reads the 735 imported decks in about two and a half hours. */
	private static final int DECKS_PER_RUN = 5;

	/** How many pages one run has a model read: five a minute stays under the limit a provider sets on calls. */
	private static final int PICTURES_PER_RUN = 5;

	/** A page with less text than this is a picture, a logo or a page number; it waits for a model to read it. */
	private static final int READABLE_CHARACTERS = 20;

	private final SolutionDirectory solutions;

	private final SearchDocumentRepository index;

	private final SearchPassageRepository passages;

	private final DocumentPages documents;

	private final TransactionTemplate transactions;

	SolutionPassages(SolutionDirectory solutions, SearchDocumentRepository index, SearchPassageRepository passages,
			DocumentPages documents, TransactionTemplate transactions) {
		this.solutions = solutions;
		this.index = index;
		this.passages = passages;
		this.documents = documents;
		this.transactions = transactions;
	}

	/** Writes the solution's customer cases again when they changed, each a passage. */
	void casesOf(UUID solutionId, String name) {
		cases(solutionId, name, solutions.customerCases(solutionId));
	}

	void cases(UUID solutionId, String name, List<CustomerCase> cases) {
		List<Passage> written = new ArrayList<>();
		for (int i = 0; i < cases.size(); i++) {
			CustomerCase one = cases.get(i);
			String text = Stream
				.of("Customer: " + one.customer(), "Title: " + one.title(), "Problem: " + one.problem(),
						"Delivered: " + one.delivered(), one.result() == null ? "" : "Result: " + one.result())
				.filter(line -> !line.isBlank())
				.collect(Collectors.joining("\n"));
			written.add(new Passage(CUSTOMER_CASE, i + 1, 0, null, name + ", customer case " + (i + 1), text,
					READ_AS_TEXT));
		}
		// The cases as they are now, as one mark: the same cases leave the passages and their vectors as they are.
		String origin = UUID
			.nameUUIDFromBytes(written.stream()
				.map(passage -> passage.heading() + "\n" + passage.text())
				.collect(Collectors.joining("\n\n"))
				.getBytes(StandardCharsets.UTF_8))
			.toString();
		Optional<String> kept = passages.origin(solutionId, CUSTOMER_CASE);
		if (written.isEmpty() ? kept.isPresent() : !kept.equals(Optional.of(origin))) {
			transactions.executeWithoutResult(status -> passages.replace(solutionId, CUSTOMER_CASE, origin, written));
		}
	}

	/** Takes out what was made from a solution that is no longer shown. What was loaded for it stays. */
	void forget(UUID solutionId) {
		passages.remove(solutionId, CUSTOMER_CASE);
		passages.remove(solutionId, DECK);
	}

	/**
	 * Reads the next decks that were attached or replaced since their passages were written, of the solutions the
	 * index holds: a solution that is not shown is not waited for, so it cannot keep the others from their turn.
	 */
	@Scheduled(fixedDelayString = "${beyondpilot.search.passages.interval}", initialDelay = 60_000)
	void readDecks() {
		Map<UUID, String> read = passages.origins(DECK);
		Map<UUID, String> names = index.titles(SearchDocumentRepository.SOLUTION);
		List<SolutionDeckFile> waiting = solutions.decks()
			.stream()
			.filter(file -> names.containsKey(file.solutionId()))
			.filter(file -> !file.fileId().toString().equals(read.get(file.solutionId())))
			.limit(DECKS_PER_RUN)
			.toList();
		for (SolutionDeckFile file : waiting) {
			solutions.deck(file.solutionId())
				.ifPresent(deck -> deck(file.solutionId(), names.get(file.solutionId()), deck));
		}
	}

	/**
	 * Has a model read the next pages that hold no text, of the deck that has most of them. It runs only while
	 * operators have chosen a model for reading documents, so choosing one starts it and taking it away stops it.
	 */
	@Scheduled(fixedDelayString = "${beyondpilot.search.passages.interval}", initialDelay = 90_000)
	void readPictures() {
		if (!documents.readsPictures()) {
			return;
		}
		passages.unreadDeck().ifPresent(this::readPictures);
	}

	void readPictures(UnreadDeck unread) {
		UUID solutionId = unread.solutionId();
		List<Integer> pages = unread.pages().stream().limit(PICTURES_PER_RUN).toList();
		SolutionDeck deck = solutions.deck(solutionId).orElse(null);
		if (deck != null && !deck.fileId().toString().equals(unread.origin())) {
			// Another file is the deck now; the job that reads decks writes its pages first.
			return;
		}
		Map<Integer, String> read = Map.of();
		boolean gone = deck == null;
		if (deck != null) {
			try {
				read = documents.readPictures(deck.content(), pages, new AiSubject("solution_deck", solutionId.toString()));
			}
			catch (AiException unavailable) {
				// The model was taken away, or every client is in use: the pages keep waiting.
				return;
			}
			catch (IOException | RuntimeException | LinkageError unreadable) {
				LOG.atWarn()
					.addKeyValue("event", "search.deck.pictures_unreadable")
					.addKeyValue("error_type", unreadable.getClass().getName())
					.addKeyValue("solution_id", solutionId)
					.log("The pages of a deck could not be drawn for a model to read");
				gone = true;
			}
		}
		Map<Integer, String> kept = read;
		// A deck that is gone or cannot be drawn is not asked for every minute: its pages are kept as read, empty.
		List<Integer> settled = gone ? pages : List.copyOf(kept.keySet());
		transactions.executeWithoutResult(status -> settled.forEach(page -> passages.saveReading(solutionId, page,
				Passages.cut(kept.getOrDefault(page, "")).stream().findFirst().orElse(""))));
	}

	/**
	 * Writes the pages of a deck as passages, in place of those of the deck before it. A deck that cannot be read
	 * leaves one unread page, so it is not tried again every run and the solution shows that its deck was not read.
	 */
	void deck(UUID solutionId, String name, SolutionDeck deck) {
		List<Passage> written = new ArrayList<>();
		try {
			List<String> pages = documents.text(deck.content(), DECK_PAGES);
			for (int i = 0; i < pages.size(); i++) {
				String heading = name + ", deck page " + (i + 1);
				List<String> cut = pages.get(i).length() < READABLE_CHARACTERS ? List.of() : Passages.cut(pages.get(i));
				if (cut.isEmpty()) {
					written.add(new Passage(DECK, i + 1, 0, null, heading, "", UNREAD));
				}
				for (int part = 0; part < cut.size(); part++) {
					written.add(new Passage(DECK, i + 1, part, null, heading, cut.get(part), READ_AS_TEXT));
				}
			}
		}
		catch (IOException | RuntimeException unreadable) {
			LOG.atWarn()
				.addKeyValue("event", "search.deck.unreadable")
				.addKeyValue("error_type", unreadable.getClass().getName())
				.addKeyValue("solution_id", solutionId)
				.log("A deck could not be read; its solution is found by its profile");
			written.clear();
		}
		if (written.isEmpty()) {
			written.add(new Passage(DECK, 1, 0, null, name + ", deck page 1", "", UNREAD));
		}
		String origin = deck.fileId().toString();
		transactions.executeWithoutResult(status -> passages.replace(solutionId, DECK, origin, written));
		LOG.atInfo()
			.addKeyValue("event", "search.deck.read")
			.addKeyValue("solution_id", solutionId)
			.addKeyValue("passages", written.size())
			.log("A deck's pages were written as passages");
	}

}
