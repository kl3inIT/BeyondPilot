package ai.genaifund.beyondpilot.matching;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.matching.EvaluationSources.Coverage;
import org.jspecify.annotations.Nullable;

/**
 * What code makes of a model's assessment of one candidate (BEY-234), whatever the model answered: an answer missing a
 * criterion or a value it needs is not taken, a finding whose quote is in none of the texts read becomes Claimed, and a
 * finding on a page that could not be read says so. Code lowers a label and never raises one.
 */
final class EvaluationRules {

	static final List<String> CRITERIA = List.of("team", "traction", "readiness", "product", "funding", "proposal");

	static final Set<String> TIERS = Set.of("strong_match", "potential_match", "to_consider", "strong_no");

	static final Set<String> ALIGNMENTS = Set.of("direct", "industry", "technology", "none");

	static final String DOCUMENTED = "documented";

	static final String CLAIMED = "claimed";

	static final String NOT_DISCLOSED = "not_disclosed";

	static final String CONTRADICTORY = "contradictory";

	private static final Set<String> LABELS = Set.of(DOCUMENTED, CLAIMED, NOT_DISCLOSED, CONTRADICTORY);

	private static final Set<String> TRACTION_KINDS = Set.of("same_use_case", "adjacent_product", "active_pilot",
			"prototype_only", "not_substantiated");

	private static final Set<String> GATES = Set.of("passed", "failed");

	private static final Set<String> EARLY_STAGE = Set.of("not_needed", "team", "prototype", "not_substantiated");

	static final String QUOTE_NOT_FOUND = "Quote not found in what was read.";

	static final String PAGE_NOT_READ = "The page it names could not be read.";

	/** A page of a file as a source names it: the file's label, then the page. */
	private static final Pattern PAGE = Pattern.compile("(.+) p\\.(\\d{1,4})");

	/** The closing of a source's tag, which a candidate's text must not be able to write. */
	private static final Pattern CLOSING_TAG = Pattern.compile("</\\s*source", Pattern.CASE_INSENSITIVE);

	private EvaluationRules() {
	}

	/**
	 * Whether an answer holds everything an assessment needs: the six criteria once each, each with a finding of a
	 * known label, a known tier and alignment, and the gate. One that does not is asked for once more.
	 */
	static boolean complete(EvaluationAnswer answer) {
		List<EvaluationAnswer.Criterion> criteria = answer.criteria();
		if (criteria == null || answer.alignment() == null || answer.gate() == null
				|| !TIERS.contains(answer.tier()) || !ALIGNMENTS.contains(answer.alignment().category())
				|| !GATES.contains(answer.gate().proposal()) || !EARLY_STAGE.contains(answer.gate().earlyStage())) {
			return false;
		}
		List<String> keys = criteria.stream().map(EvaluationAnswer.Criterion::key).toList();
		if (keys.size() != CRITERIA.size() || !keys.containsAll(CRITERIA)) {
			return false;
		}
		return criteria.stream()
			.allMatch(criterion -> criterion.findings() != null && !criterion.findings().isEmpty()
					&& criterion.findings().stream().allMatch(finding -> LABELS.contains(finding.label())));
	}

	/**
	 * The assessment as it is kept, from a complete answer and the texts it was asked about.
	 * @param texts the sources read, by label
	 * @param coverage what was read of each record and file
	 */
	static Assessed assessed(EvaluationAnswer answer, Map<String, String> texts, List<Coverage> coverage) {
		EvaluationAnswer.Alignment alignment = Objects.requireNonNull(answer.alignment());
		EvaluationAnswer.Gate gate = Objects.requireNonNull(answer.gate());
		List<Criterion> criteria = new ArrayList<>();
		for (String key : CRITERIA) {
			EvaluationAnswer.Criterion given = Objects.requireNonNull(answer.criteria())
				.stream()
				.filter(criterion -> key.equals(criterion.key()))
				.findFirst()
				.orElseThrow();
			List<Finding> findings = Objects.requireNonNull(given.findings())
				.stream()
				.map(finding -> finding(finding, texts, coverage))
				.toList();
			String kind = "traction".equals(key) && TRACTION_KINDS.contains(given.tractionKind()) ? given.tractionKind()
					: null;
			criteria.add(new Criterion(key, kind, findings));
		}
		return new Assessed(Objects.requireNonNull(answer.tier()), Boolean.TRUE.equals(answer.provisional()),
				Objects.requireNonNull(alignment.category()), text(alignment.reason()),
				new Gate(Objects.requireNonNull(gate.proposal()), Objects.requireNonNull(gate.earlyStage()),
						text(gate.reason())),
				List.copyOf(criteria),
				new Notes(text(answer.why()), text(answer.concern()), text(answer.next()), text(answer.rationale()),
						listed(answer.contradictions()), listed(answer.questions())),
				Boolean.TRUE.equals(answer.instructionsInSources()));
	}

	/** One finding, lowered to Claimed when its quote is in none of the texts read. */
	static Finding finding(EvaluationAnswer.Finding given, Map<String, String> texts, List<Coverage> coverage) {
		String label = Objects.requireNonNull(given.label());
		String quote = text(given.quote());
		String source = text(given.source());
		String state = Quotes.state(quote, source, texts);
		String gap = text(given.gap());
		boolean lowered = false;
		if (Quotes.NOT_FOUND.equals(state) && DOCUMENTED.equals(label)) {
			label = CLAIMED;
			lowered = true;
		}
		boolean unread = unreadPage(source, texts, coverage);
		if (unread) {
			gap = joined(gap, PAGE_NOT_READ);
		}
		else if (Quotes.NOT_FOUND.equals(state)) {
			gap = joined(gap, QUOTE_NOT_FOUND);
		}
		return new Finding(label, text(given.summary()), text(given.finding()), gap, source, quote, state, lowered);
	}

	/**
	 * Whether a source names a page of a file that was opened, and the page is not among the texts read: it held no
	 * text even from its picture, or it lay past the limits.
	 */
	static boolean unreadPage(String source, Map<String, String> texts, List<Coverage> coverage) {
		Matcher page = PAGE.matcher(source.strip());
		return page.matches() && !texts.containsKey(source.strip()) && coverage.stream()
			.anyMatch(read -> read.file() != null && read.label().equalsIgnoreCase(page.group(1).strip()));
	}

	/**
	 * A candidate's text as it is put inside a source's tag: a closing tag it holds is broken, so that what it wrote
	 * cannot step out of the tag and read as instructions.
	 */
	static String contained(String text) {
		return CLOSING_TAG.matcher(text).replaceAll("< /source");
	}

	private static String joined(String gap, String more) {
		return gap.isEmpty() ? more : gap + " " + more;
	}

	private static List<String> listed(@Nullable List<String> values) {
		return values == null ? List.of()
				: values.stream().filter(Objects::nonNull).map(String::strip).filter(value -> !value.isEmpty()).toList();
	}

	private static String text(@Nullable String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * An assessment as it is kept.
	 * @param instructionsInSources the model said a source addressed it, which an operator is shown
	 */
	record Assessed(String tier, boolean provisional, String alignment, String alignmentReason, Gate gate,
			List<Criterion> criteria, Notes notes, boolean instructionsInSources) {
	}

	/** @param tractionKind for traction only, and only a known one */
	record Criterion(String key, @Nullable String tractionKind, List<Finding> findings) {
	}

	/**
	 * @param quoteState what {@link Quotes#state} found of the quote
	 * @param lowered the label was Documented in the answer and code made it Claimed
	 */
	record Finding(String label, String summary, String finding, String gap, String source, String quote,
			String quoteState, boolean lowered) {
	}

	record Gate(String proposal, String earlyStage, String reason) {
	}

	record Notes(String why, String concern, String next, String rationale, List<String> contradictions,
			List<String> questions) {
	}

}
