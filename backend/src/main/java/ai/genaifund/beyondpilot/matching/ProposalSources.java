package ai.genaifund.beyondpilot.matching;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.ai.AiSubject;
import ai.genaifund.beyondpilot.ai.DocumentPages;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import ai.genaifund.beyondpilot.search.SolutionEvidence;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * What the model reads about one proposal a use case received (BEY-229), each part under the label a quote must name:
 * the proposal's approach ({@code proposal}), its team ({@code team}), each page of its PDF ({@code proposal deck p.3}),
 * and for each solution it offers, in the proposal's order, that solution's sources as a candidate has them, after the
 * solution's place: {@code solution 1 profile}, {@code solution 1 deck p.2}, {@code solution 1 website 3}. The proposal
 * comes first: it is what the vendor wrote for this use case.
 */
@Component
class ProposalSources {

	private static final Logger LOG = LoggerFactory.getLogger(ProposalSources.class);

	static final String PROPOSAL = "proposal";

	static final String TEAM = "team";

	/** The proposal's PDF held no text, even read from the pictures of its pages. */
	static final String PROPOSAL_DECK = "proposal_deck";

	private static final String PDF = "application/pdf";

	/** How much of the proposal's PDF is read: pages, and characters of all. */
	private static final int DECK_PAGES = 40;

	private static final int DECK_LIMIT = 30_000;

	/** How many pages without text of the PDF a model reads from their picture. */
	private static final int PICTURE_PAGES = 10;

	/** The label of a solution's source, with the solution's place in the proposal. */
	private static final Pattern OF_SOLUTION = Pattern.compile("solution (\\d{1,3}) (.+)", Pattern.CASE_INSENSITIVE);

	private final SolutionDirectory solutions;

	private final SolutionEvidence evidence;

	private final DocumentPages documents;

	ProposalSources(SolutionDirectory solutions, SolutionEvidence evidence, DocumentPages documents) {
		this.solutions = solutions;
		this.evidence = evidence;
		this.documents = documents;
	}

	/**
	 * What a proposal says without its PDF, and the PDF as a file: enough to tell whether it changed since it was
	 * judged, without reading the file. A stored file never changes, so its identifier stands for its text.
	 */
	record Material(SentUseCaseProposal proposal, Map<String, String> solutionTexts, String fingerprint) {
	}

	/** What a proposal holds now, its PDF unread. */
	Material material(SentUseCaseProposal proposal) {
		Map<String, String> texts = new LinkedHashMap<>();
		int place = 0;
		for (SentUseCaseProposal.Solution offered : proposal.solutions()) {
			place++;
			String prefix = "solution " + place + " ";
			IndexedSolution solution = solutions.indexed(offered.id()).orElse(null);
			if (solution == null) {
				// A solution GenAI Fund has not approved is read from what the proposal module knows of it.
				StringBuilder profile = new StringBuilder("Name: ").append(offered.name());
				if (offered.summary() != null && !offered.summary().isBlank()) {
					profile.append("\nSummary: ").append(offered.summary().strip());
				}
				texts.put(prefix + Sources.PROFILE, profile.toString());
				continue;
			}
			Sources.of(solution, evidence.passagesOf(offered.id()))
				.texts()
				.forEach((label, text) -> texts.put(prefix + label, text));
		}
		StringBuilder all = new StringBuilder();
		all.append(PROPOSAL).append('\n').append(text(proposal.approach())).append('\n');
		all.append(TEAM).append('\n').append(text(proposal.teamBackground())).append('\n');
		all.append("pdf\n").append(proposal.deck() == null ? "" : proposal.deck().fileId()).append('\n');
		texts.forEach((label, text) -> all.append(label).append('\n').append(text).append('\n'));
		return new Material(proposal, texts, all.toString());
	}

	/**
	 * Every source of a proposal by its label, its PDF read now. A PDF page that is only a picture is read by the model
	 * chosen for reading documents, when there is one. A PDF that cannot be read is named in {@code unread}; the rest
	 * is judged.
	 * @param runId the run that reads it, which a picture read is recorded under
	 */
	Sources read(Material material, UUID runId) {
		SentUseCaseProposal proposal = material.proposal();
		Map<String, String> texts = new LinkedHashMap<>();
		String approach = text(proposal.approach());
		texts.put(PROPOSAL, approach.isEmpty() ? "The proposal holds no approach." : approach);
		String team = text(proposal.teamBackground());
		if (!team.isEmpty()) {
			texts.put(TEAM, team);
		}
		List<String> unread = new ArrayList<>();
		SentUseCaseProposal.Deck deck = proposal.deck();
		if (deck != null) {
			int read = deck(deck, runId, texts);
			if (read == 0) {
				unread.add(PROPOSAL_DECK);
			}
		}
		texts.putAll(material.solutionTexts());
		return new Sources(texts, List.copyOf(unread));
	}

	/** Reads the PDF's pages into the texts, to the limits; answers how many characters were read. */
	private int deck(SentUseCaseProposal.Deck deck, UUID runId, Map<String, String> texts) {
		if (!PDF.equals(deck.mediaType())) {
			return 0;
		}
		try {
			List<String> pages = new ArrayList<>(documents.text(deck.content(), DECK_PAGES));
			List<Integer> pictures = new ArrayList<>();
			for (int page = 0; page < pages.size() && pictures.size() < PICTURE_PAGES; page++) {
				if (pages.get(page).isBlank()) {
					pictures.add(page + 1);
				}
			}
			if (!pictures.isEmpty() && documents.readsPictures()) {
				documents.readPictures(deck.content(), pictures, new AiSubject(MatchingRuns.SUBJECT, runId.toString()))
					.forEach((page, read) -> pages.set(page - 1, read));
			}
			int room = DECK_LIMIT;
			for (int page = 0; page < pages.size() && room > 0; page++) {
				String text = pages.get(page).strip();
				if (!text.isEmpty()) {
					String kept = text.substring(0, Math.min(text.length(), room));
					texts.put("proposal deck p." + (page + 1), kept);
					room -= kept.length();
				}
			}
			return DECK_LIMIT - room;
		}
		catch (IOException | RuntimeException | LinkageError unreadable) {
			LOG.atInfo()
				.addKeyValue("event", "matching.proposal_deck.not_read")
				.addKeyValue("error_type", unreadable.getClass().getName())
				.addKeyValue("fileId", deck.fileId())
				.log("The PDF of a proposal was not read for its evaluation");
			return 0;
		}
	}

	/**
	 * The address of the web page a label names, for a quote from a solution's website; null for any other source.
	 * @param webPages the address of each web page kept, by solution and by the page's place among the site's
	 */
	static @Nullable String webPage(String label, List<UUID> solutionIds, Map<UUID, Map<Integer, String>> webPages) {
		Matcher named = OF_SOLUTION.matcher(label.strip());
		if (!named.matches()) {
			return null;
		}
		int place = Integer.parseInt(named.group(1));
		if (place < 1 || place > solutionIds.size()) {
			return null;
		}
		return Sources.webPage(named.group(2), webPages.getOrDefault(solutionIds.get(place - 1), Map.of()));
	}

	private static String text(@Nullable String value) {
		return value == null ? "" : value.strip();
	}

}
