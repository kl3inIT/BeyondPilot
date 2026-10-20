package ai.genaifund.beyondpilot.matching;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.AiSubject;
import ai.genaifund.beyondpilot.ai.DocumentPages;
import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Candidate;
import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Entry;
import ai.genaifund.beyondpilot.proposal.ProgramSubmission;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import ai.genaifund.beyondpilot.search.SolutionEvidence;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * What the model reads about one candidate of a program's evaluation (BEY-234), each part under the label a finding's
 * source must name, and what could and could not be read (Kai's methodology, section 8):
 * <ul>
 * <li>the application's form: {@code form: organization}, {@code form: solution}, {@code form: traction},
 * {@code form: built with}, and each answer under its question, {@code form: <question>};</li>
 * <li>its deck, {@code application deck p.3}, and each file it answered with, {@code application file 1 p.2};</li>
 * <li>each proposal to the program's use cases, in order: {@code proposal 1}, {@code proposal 1 team},
 * {@code proposal 1 p.4};</li>
 * <li>the solution as BeyondPilot lists it: {@code solution profile}, {@code solution deck p.2},
 * {@code solution website 1}, {@code solution customer case 1}.</li>
 * </ul>
 * What the candidate wrote for the program comes first. A file held twice is read once and named as the same.
 */
@Component
class EvaluationSources {

	private static final Logger LOG = LoggerFactory.getLogger(EvaluationSources.class);

	/** What a picture read for an evaluation is recorded under, with the run's identifier. */
	static final String SUBJECT = "evaluation_run";

	/** How much of one file is read: pages, and characters of all its pages. */
	static final int FILE_PAGES = 40;

	static final int FILE_LIMIT = 30_000;

	/** How many pages without text of one file a model reads from their picture. */
	private static final int PICTURE_PAGES = 10;

	private static final String NOT_OPENED = "could not be opened as a PDF";

	private final SolutionDirectory solutions;

	private final SolutionEvidence evidence;

	private final DocumentPages documents;

	EvaluationSources(SolutionDirectory solutions, SolutionEvidence evidence, DocumentPages documents) {
		this.solutions = solutions;
		this.evidence = evidence;
		this.documents = documents;
	}

	/**
	 * Every source of a candidate by its label, and how much of each record and file was read.
	 * @param runId the run that reads it, which a picture read is recorded under
	 */
	Read read(Candidate candidate, UUID runId) {
		Map<String, String> texts = new LinkedHashMap<>();
		List<Coverage> coverage = new ArrayList<>();
		Map<String, String> seen = new HashMap<>();
		AiSubject subject = new AiSubject(SUBJECT, runId.toString());
		ProgramSubmission.Solution applied = null;
		int proposalPlace = 0;
		for (Entry entry : candidate.records()) {
			if (!entry.read()) {
				coverage.add(Coverage.listed(entry, "a draft, listed and not read"));
				continue;
			}
			if (EvaluationCandidates.APPLICATION.equals(entry.kind())) {
				ProgramSubmission.Sent sent = Objects.requireNonNull(entry.requireApplication().sent());
				applied = sent.solution();
				form(sent, texts);
				coverage.add(Coverage.listed(entry, sent.answers().size() + " answers of the form"));
				if (sent.deck() != null) {
					file(entry, "application deck", sent.deck(), subject, texts, coverage, seen);
				}
				int place = 0;
				for (ProgramSubmission.Answer answer : sent.answers()) {
					if (answer.file() != null) {
						place++;
						file(entry, "application file " + place, answer.file(), subject, texts, coverage, seen);
					}
				}
			}
			else {
				SentUseCaseProposal proposal = entry.requireProposal();
				proposalPlace++;
				String label = "proposal " + proposalPlace;
				String approach = text(proposal.approach());
				texts.put(label, approach.isEmpty() ? "The proposal holds no approach." : approach);
				if (!text(proposal.teamBackground()).isEmpty()) {
					texts.put(label + " team", text(proposal.teamBackground()));
				}
				coverage.add(Coverage.listed(entry, "approach and team of " + label));
				SentUseCaseProposal.Deck deck = proposal.deck();
				if (deck != null) {
					ProgramSubmission.File file = new ProgramSubmission.File(deck.fileId(), deck.fileName(),
							deck.content());
					file(entry, label, file, subject, texts, coverage, seen);
				}
			}
		}
		solution(candidate.solutionId(), applied, texts);
		return new Read(texts, List.copyOf(coverage));
	}

	/** What the application's form says, each part under its label. */
	private static void form(ProgramSubmission.Sent sent, Map<String, String> texts) {
		ProgramSubmission.Organization organization = sent.organization();
		StringBuilder who = new StringBuilder("Name: ").append(organization.name())
			.append("\nApplying as: ")
			.append(organization.type());
		line(who, "Country", organization.country());
		line(who, "Team size", organization.teamSize());
		line(who, "Website", organization.website());
		line(who, "Team background", organization.teamBackground());
		texts.put("form: organization", who.toString());
		ProgramSubmission.Solution solution = sent.solution();
		StringBuilder what = new StringBuilder("Name: ").append(solution.name());
		line(what, "What it does", solution.summary());
		line(what, "Problem it solves", solution.problemsSolved());
		line(what, "Stage", solution.maturity());
		line(what, "Product demo", solution.demoUrl());
		texts.put("form: solution", what.toString());
		if (!text(sent.traction()).isEmpty()) {
			texts.put("form: traction", text(sent.traction()));
		}
		if (!sent.builtWith().isEmpty()) {
			texts.put("form: built with", String.join(", ", sent.builtWith()));
		}
		for (ProgramSubmission.Answer answer : sent.answers()) {
			if (answer.file() == null && !text(answer.value()).isEmpty()) {
				texts.merge("form: " + answer.question().strip(), text(answer.value()),
						(before, more) -> before + "\n" + more);
			}
		}
	}

	/** Reads one file's pages into the texts, to the limits, once whatever record holds it. */
	private void file(Entry entry, String label, ProgramSubmission.File file, AiSubject subject,
			Map<String, String> texts, List<Coverage> coverage, Map<String, String> seen) {
		String held = seen.get(file.id().toString());
		if (held != null) {
			coverage.add(
					new Coverage(entry.kind(), entry.id(), label, file.id(), file.name(), 0, 0, List.of(), false, held));
			return;
		}
		try {
			// One page more than is read tells a longer file from one of exactly the limit.
			List<String> pages = new ArrayList<>(documents.text(file.content(), FILE_PAGES + 1));
			int count = pages.size();
			if (count > FILE_PAGES) {
				pages.subList(FILE_PAGES, count).clear();
			}
			List<Integer> pictures = new ArrayList<>();
			for (int page = 0; page < pages.size() && pictures.size() < PICTURE_PAGES; page++) {
				if (pages.get(page).isBlank()) {
					pictures.add(page + 1);
				}
			}
			if (!pictures.isEmpty() && documents.readsPictures()) {
				documents.readPictures(file.content(), pictures, subject)
					.forEach((page, read) -> pages.set(page - 1, read));
			}
			Paged paged = paged(label, pages, count);
			String same = paged.texts().isEmpty() ? null : seen.get(Quotes.fingerprint(paged.texts().values()
				.toArray(String[]::new)));
			if (same != null) {
				coverage.add(new Coverage(entry.kind(), entry.id(), label, file.id(), file.name(), count, 0, List.of(),
						false, same));
				return;
			}
			seen.put(file.id().toString(), label);
			if (!paged.texts().isEmpty()) {
				seen.put(Quotes.fingerprint(paged.texts().values().toArray(String[]::new)), label);
			}
			texts.putAll(paged.texts());
			coverage.add(new Coverage(entry.kind(), entry.id(), label, file.id(), file.name(), count,
					paged.texts().size(), paged.unread(), paged.cut(), null));
		}
		catch (IOException | RuntimeException | LinkageError unreadable) {
			LOG.atInfo()
				.addKeyValue("event", "matching.evaluation_file.not_read")
				.addKeyValue("error_type", unreadable.getClass().getName())
				.addKeyValue("file_id", file.id())
				.log("A file of a candidate was not read for its evaluation");
			coverage.add(new Coverage(entry.kind(), entry.id(), label, file.id(), file.name(), 0, 0, List.of(), false,
					NOT_OPENED));
		}
	}

	/**
	 * The pages of one file under their labels, to {@link #FILE_LIMIT} characters, and the pages left unread: those
	 * with no text even from their picture, and those past {@link #FILE_PAGES}.
	 * @param pages the text of each page read, in order, an empty string for a page without text
	 * @param count how many pages the file has, or more than were read
	 */
	static Paged paged(String label, List<String> pages, int count) {
		Map<String, String> texts = new LinkedHashMap<>();
		List<Integer> unread = new ArrayList<>();
		int room = FILE_LIMIT;
		boolean cut = count > pages.size();
		for (int page = 0; page < pages.size(); page++) {
			String text = pages.get(page).strip();
			if (text.isEmpty()) {
				unread.add(page + 1);
				continue;
			}
			if (room <= 0) {
				cut = true;
				continue;
			}
			String kept = text.substring(0, Math.min(text.length(), room));
			texts.put(label + " p." + (page + 1), kept);
			room -= kept.length();
			cut |= kept.length() < text.length();
		}
		return new Paged(texts, List.copyOf(unread), cut);
	}

	/** The solution as BeyondPilot lists it, or as the application describes it when it is not listed. */
	private void solution(UUID solutionId, ProgramSubmission.@Nullable Solution applied, Map<String, String> texts) {
		IndexedSolution listed = solutions.indexed(solutionId).orElse(null);
		if (listed != null) {
			Sources.of(listed, evidence.passagesOf(solutionId))
				.texts()
				.forEach((label, text) -> texts.put("solution " + label, text));
			return;
		}
		if (applied == null) {
			return;
		}
		StringBuilder profile = new StringBuilder("Name: ").append(applied.name());
		line(profile, "What it does", applied.summary());
		line(profile, "Problem it solves", applied.problemsSolved());
		line(profile, "Stage", applied.maturity());
		texts.put("solution profile", profile.toString());
	}

	private static void line(StringBuilder text, String label, @Nullable String value) {
		if (!text(value).isEmpty()) {
			text.append('\n').append(label).append(": ").append(text(value));
		}
	}

	private static String text(@Nullable String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * The sources of a candidate by label, in the order the model reads them, and what was read of each record.
	 */
	record Read(Map<String, String> texts, List<Coverage> coverage) {
	}

	/** The pages of one file under their labels, the pages left unread, and whether a limit cut it. */
	record Paged(Map<String, String> texts, List<Integer> unread, boolean cut) {
	}

	/**
	 * What was read of one record or file.
	 * @param record {@code application} or {@code proposal}
	 * @param recordId the application or the proposal
	 * @param fileId the file read; null for a record without a file
	 * @param label the label its pages are read under; for a record without a file, what was read of it
	 * @param file the file's name; null for a record without a file
	 * @param pages how many pages the file has; {@link #FILE_PAGES} + 1 stands for more than were read
	 * @param read how many pages were read
	 * @param unread the pages that held no text, even from their picture
	 * @param cut whether pages were left out at the limits
	 * @param note the label of the file it repeats, which was read in its place, or why it could not be read
	 */
	record Coverage(String record, UUID recordId, String label, @Nullable UUID fileId, @Nullable String file,
			int pages, int read, List<Integer> unread, boolean cut, @Nullable String note) {

		static Coverage listed(Entry entry, String what) {
			return new Coverage(entry.kind(), entry.id(), what, null, null, 0, 0, List.of(), false, null);
		}

	}

}
