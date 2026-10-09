package ai.genaifund.beyondpilot.matching;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.Collection;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

/**
 * Whether the words a model quoted are really where it says. The model only proposes; a quote that is not found
 * lowers its finding, and nothing here raises one.
 */
final class Quotes {

	/** The quote is in the source it names, word for word. */
	static final String EXACT = "exact";

	/** The quote is word for word in another source of the same solution. */
	static final String OTHER_SOURCE = "other_source";

	/** Most of the quote's words are in the source: the model joined or trimmed sentences. */
	static final String CLOSE = "close";

	/** The quote is in no source. */
	static final String NOT_FOUND = "not_found";

	/** Nothing was quoted. */
	static final String NONE = "none";

	/** How much of a quote's telling words a source must hold to count as close. */
	private static final double CLOSE_SHARE = 0.6;

	private static final Pattern SPACE = Pattern.compile("\\s+");

	private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]+");

	private static final Set<String> COMMON = Set.of("a", "an", "the", "of", "on", "in", "at", "to", "for", "and", "or",
			"with", "as", "by", "is", "was", "were", "be", "been", "are", "this", "that", "it", "its", "from", "into",
			"using", "used", "use", "via", "per", "our", "we", "you", "your", "their", "they", "has", "have", "had",
			"can", "will");

	private Quotes() {
	}

	/**
	 * Where a quote stands among the sources of one solution, or the parts of one brief.
	 * @param source the label the model gave; null or unknown when it gave none that exists
	 * @param sources the texts by label
	 */
	static String state(@Nullable String quote, @Nullable String source, Map<String, String> sources) {
		String wanted = normal(quote);
		if (wanted.isEmpty()) {
			return NONE;
		}
		String named = source == null ? null : sources.get(source);
		if (named != null && normal(named).contains(wanted)) {
			return EXACT;
		}
		if (sources.values().stream().anyMatch(text -> normal(text).contains(wanted))) {
			return OTHER_SOURCE;
		}
		Set<String> telling = new HashSet<>(words(wanted));
		telling.removeIf(word -> word.length() < 2 || COMMON.contains(word));
		if (telling.size() >= 3) {
			Collection<String> searched = named != null ? List.of(named) : sources.values();
			for (String text : searched) {
				Set<String> held = words(normal(text));
				long shared = telling.stream().filter(held::contains).count();
				if ((double) shared / telling.size() >= CLOSE_SHARE) {
					return CLOSE;
				}
			}
		}
		return NOT_FOUND;
	}

	/** Whether a state means the quote stands. */
	static boolean stands(String state) {
		return EXACT.equals(state) || OTHER_SOURCE.equals(state) || CLOSE.equals(state);
	}

	/** Text as the check compares it: one Unicode form, lower case, single spaces. */
	static String normal(@Nullable String text) {
		if (text == null) {
			return "";
		}
		return SPACE.matcher(Normalizer.normalize(text, Normalizer.Form.NFKC)).replaceAll(" ").strip()
			.toLowerCase(Locale.ROOT);
	}

	private static Set<String> words(String normalized) {
		Set<String> words = new HashSet<>();
		Matcher matcher = WORD.matcher(normalized);
		while (matcher.find()) {
			words.add(matcher.group());
		}
		return words;
	}

	/** A fingerprint of some texts, to tell whether what was read is what is there now. */
	static String fingerprint(String... texts) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			for (String text : texts) {
				digest.update(text.getBytes(StandardCharsets.UTF_8));
				digest.update((byte) 0);
			}
			return HexFormat.of().formatHex(digest.digest());
		}
		catch (NoSuchAlgorithmException impossible) {
			throw new IllegalStateException(impossible);
		}
	}

}
