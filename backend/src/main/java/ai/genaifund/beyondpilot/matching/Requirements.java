package ai.genaifund.beyondpilot.matching;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.ai.AiChat;
import ai.genaifund.beyondpilot.ai.AiModels;
import ai.genaifund.beyondpilot.ai.AiSubject;
import ai.genaifund.beyondpilot.ai.AiTask;
import ai.genaifund.beyondpilot.ai.DocumentPages;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Step;
import ai.genaifund.beyondpilot.usecase.UseCaseBrief;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The requirements of a use case: what a product must do, and the conditions it would be delivered under. The model
 * lists them from the brief, the organization's own list and the attached files; code keeps those whose quote is
 * really in what was read. They are kept until the brief changes, so a second run asks nothing.
 */
@Component
class Requirements {

	private static final Logger LOG = LoggerFactory.getLogger(Requirements.class);

	private static final String PDF = "application/pdf";

	/** How much of the attached files is read: pages of one file, and characters of all. */
	private static final int ATTACHMENT_PAGES = 40;

	private static final int ATTACHMENTS_LIMIT = 40_000;

	/** How many pages without text of one file a model reads from their picture. */
	private static final int PICTURE_PAGES = 10;

	private final MatchingRepository matching;

	private final AiModels models;

	private final DocumentPages documents;

	private final TransactionTemplate transactions;

	Requirements(MatchingRepository matching, AiModels models, DocumentPages documents,
			TransactionTemplate transactions) {
		this.matching = matching;
		this.models = models;
		this.documents = documents;
		this.transactions = transactions;
	}

	/** What the model answers. */
	record Extracted(@Nullable List<Item> requirements) {

		/**
		 * @param kind {@code capability} or {@code constraint}
		 * @param necessity {@code required} or {@code optional}
		 * @param statement one sentence in neutral words
		 * @param quote the passage of the brief it comes from, copied word for word
		 */
		record Item(@Nullable String kind, @Nullable String necessity, @Nullable String statement,
				@Nullable String quote) {
		}

	}

	/**
	 * The requirements with what they were read from.
	 * @param sourceHash the fingerprint of the brief they belong to
	 */
	record Read(List<Requirement> requirements, String sourceHash) {
	}

	/**
	 * What tells one brief from another without opening a file: its words, the organization's list, which files are
	 * attached, and the version of the prompt.
	 */
	static String fingerprint(UseCaseBrief brief) {
		return Quotes.fingerprint(Integer.toString(Prompts.VERSION), Prompts.brief(brief, Map.of()),
				brief.attachments().stream().map(file -> file.fileId().toString()).collect(Collectors.joining(",")));
	}

	/**
	 * The requirements of the brief: those kept while it is unchanged, read again by the model otherwise.
	 * @param runId the run that asks, which the step and the calls are recorded under
	 * @throws RuntimeException when the model's provider refused or failed, or its answer never fitted
	 */
	Read of(UseCaseBrief brief, UUID runId) {
		String hash = fingerprint(brief);
		List<Requirement> kept = matching.requirements(brief.id());
		if (!kept.isEmpty() && hash.equals(matching.requirementsSource(brief.id()).orElse(null))) {
			matching.addToStep(runId, new Step(MatchingRepository.REQUIREMENTS, 1, kept.size(), 0, 0, 0, 0));
			return new Read(kept, hash);
		}
		long started = System.nanoTime();
		Map<String, String> attachments = attachments(brief, runId);
		String text = Prompts.brief(brief, attachments);
		Asking.Answer<Extracted> answer;
		try (AiChat chat = models.chat(AiTask.MATCHING, new AiSubject("matching_run", runId.toString()))) {
			answer = Asking.ask(chat, Prompts.REQUIREMENTS, text, Extracted.class);
		}
		List<Requirement> checked = checked(answer.value(), text);
		transactions.executeWithoutResult(status -> matching.replaceRequirements(brief.id(), hash, checked));
		matching.addToStep(runId, new Step(MatchingRepository.REQUIREMENTS, 1, checked.size(), answer.calls(),
				answer.inputTokens(), answer.outputTokens(), (System.nanoTime() - started) / 1_000_000));
		return new Read(checked, hash);
	}

	/** The model's list as it is kept: capabilities first, each of a known kind with a quote found in the brief. */
	static List<Requirement> checked(Extracted extracted, String brief) {
		Map<String, String> source = Map.of("brief", brief);
		List<Extracted.Item> usable = new ArrayList<>();
		if (extracted.requirements() != null) {
			for (Extracted.Item item : extracted.requirements()) {
				if (item == null || item.statement() == null || item.statement().isBlank()) {
					continue;
				}
				boolean known = (MatchingRepository.CAPABILITY.equals(item.kind())
						|| MatchingRepository.CONSTRAINT.equals(item.kind()))
						&& (MatchingRepository.REQUIRED.equals(item.necessity())
								|| MatchingRepository.OPTIONAL.equals(item.necessity()));
				// A requirement the brief does not say is the model's own, and is left out.
				if (known && Quotes.stands(Quotes.state(item.quote(), "brief", source))) {
					usable.add(item);
				}
			}
		}
		usable.sort((one, other) -> Boolean.compare(MatchingRepository.CONSTRAINT.equals(one.kind()),
				MatchingRepository.CONSTRAINT.equals(other.kind())));
		List<Requirement> requirements = new ArrayList<>();
		for (Extracted.Item item : usable) {
			requirements.add(new Requirement(requirements.size() + 1, String.valueOf(item.kind()),
					String.valueOf(item.necessity()), String.valueOf(item.statement()).strip(),
					String.valueOf(item.quote()).strip()));
		}
		return requirements;
	}

	/**
	 * The text of the attached PDFs by file name, to a limit. A page that is only a picture is read by the model
	 * chosen for reading documents, when there is one. A file that cannot be read is left out: the brief still
	 * stands without it.
	 */
	private Map<String, String> attachments(UseCaseBrief brief, UUID runId) {
		Map<String, String> texts = new LinkedHashMap<>();
		int room = ATTACHMENTS_LIMIT;
		for (UseCaseBrief.Attachment file : brief.attachments()) {
			if (room <= 0 || !PDF.equals(file.mediaType())) {
				continue;
			}
			try {
				List<String> pages = new ArrayList<>(documents.text(file.content(), ATTACHMENT_PAGES));
				List<Integer> pictures = new ArrayList<>();
				for (int page = 0; page < pages.size() && pictures.size() < PICTURE_PAGES; page++) {
					if (pages.get(page).isBlank()) {
						pictures.add(page + 1);
					}
				}
				if (!pictures.isEmpty() && documents.readsPictures()) {
					documents.readPictures(file.content(), pictures, new AiSubject("matching_run", runId.toString()))
						.forEach((page, read) -> pages.set(page - 1, read));
				}
				String text = pages.stream().filter(page -> !page.isBlank()).collect(Collectors.joining("\n\n"));
				if (!text.isBlank()) {
					String kept = text.substring(0, Math.min(text.length(), room));
					texts.put(file.fileName(), kept);
					room -= kept.length();
				}
			}
			catch (IOException | RuntimeException | LinkageError unreadable) {
				LOG.atInfo()
					.addKeyValue("event", "matching.attachment.not_read")
					.addKeyValue("error_type", unreadable.getClass().getName())
					.addKeyValue("fileId", file.fileId())
					.log("A file attached to a use case was not read for its requirements");
			}
		}
		return texts;
	}

}
