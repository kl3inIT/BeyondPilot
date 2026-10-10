package ai.genaifund.beyondpilot.matching;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.search.SolutionEvidence.Passage;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import org.jspecify.annotations.Nullable;

/**
 * What the model reads about one solution, each part under the label a quote must name: its profile, each customer
 * case, each page of its deck and each page of its website. Long material is read to a limit, the deck before the
 * website, so one solution's call stays within what a model reads well.
 * @param texts the text of each source by its label, in the order they are shown
 * @param unread the sources that held no text: {@code deck}, {@code website}. A solution that has no deck holds no
 * deck text either; which of these a reader is told of is decided by {@link #unread(List, boolean, boolean)}
 */
record Sources(Map<String, String> texts, List<String> unread) {

	static final String PROFILE = "profile";

	private static final String DECK = "deck";

	private static final String WEBSITE = "website";

	private static final String CUSTOMER_CASE = "customer_case";

	/** The label of a page of the website, with its place among the site's pages. */
	private static final Pattern WEB_PAGE = Pattern.compile("website (\\d{1,6})", Pattern.CASE_INSENSITIVE);

	/** How much of a deck is read, in characters. */
	private static final int DECK_LIMIT = 30_000;

	/** How much of one web page, and of a whole website, is read. */
	private static final int WEB_PAGE_LIMIT = 8_000;

	private static final int WEBSITE_LIMIT = 24_000;

	static Sources of(IndexedSolution solution, List<Passage> passages) {
		Map<String, String> texts = new LinkedHashMap<>();
		texts.put(PROFILE, profile(solution));
		int deck = 0;
		int website = 0;
		for (Passage passage : passages) {
			String text = passage.text().strip();
			switch (passage.source()) {
				case CUSTOMER_CASE -> texts.put("customer case " + passage.page(), text);
				case DECK -> {
					if (deck < DECK_LIMIT) {
						String kept = text.substring(0, Math.min(text.length(), DECK_LIMIT - deck));
						texts.merge("deck p." + passage.page(), kept, (before, more) -> before + "\n" + more);
						deck += kept.length();
					}
				}
				case WEBSITE -> {
					String label = "website " + passage.page();
					int held = texts.getOrDefault(label, "").length();
					int room = Math.min(WEB_PAGE_LIMIT - held, WEBSITE_LIMIT - website);
					if (room > 0) {
						String kept = text.substring(0, Math.min(text.length(), room));
						texts.merge(label, kept, (before, more) -> before + "\n" + more);
						website += kept.length();
					}
				}
				default -> {
					// A source this version does not know is left out rather than shown under a wrong label.
				}
			}
		}
		List<String> unread = new ArrayList<>();
		if (deck == 0) {
			unread.add(DECK);
		}
		if (website == 0) {
			unread.add(WEBSITE);
		}
		return new Sources(texts, List.copyOf(unread));
	}

	/**
	 * The sources a reader is told could not be read: those that held no text when the solution was judged, of the
	 * material the solution has. A solution without a deck has no deck that could not be read. It is decided when the
	 * candidates are read, from what was kept, so it holds for a judgment kept before this rule too.
	 * @param heldNoText what {@link #unread} kept: {@code deck}, {@code website}
	 * @param deck whether the solution has a deck
	 * @param website whether the solution names a website
	 */
	static List<String> unread(List<String> heldNoText, boolean deck, boolean website) {
		return heldNoText.stream()
			.filter(source -> (DECK.equals(source) && deck) || (WEBSITE.equals(source) && website))
			.toList();
	}

	/**
	 * The address of the web page a label names, to open the page a quote comes from; null for any other source, for
	 * a page that is no longer kept, and for an address that is not a web address, which is never answered.
	 * @param label the label a finding names its source by, such as {@code website 2}
	 * @param pages the address of each web page kept for the solution, by its place among the site's
	 */
	static @Nullable String webPage(String label, Map<Integer, String> pages) {
		Matcher named = WEB_PAGE.matcher(label.strip());
		if (!named.matches()) {
			return null;
		}
		String address = pages.get(Integer.valueOf(named.group(1)));
		if (address == null) {
			return null;
		}
		try {
			URI uri = new URI(address.strip());
			String scheme = uri.getScheme();
			boolean web = scheme != null && (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"));
			return web && uri.getHost() != null ? uri.toString() : null;
		}
		catch (URISyntaxException malformed) {
			return null;
		}
	}

	/** Everything the model is shown, to tell whether a judgment was made from what is there now. */
	String fingerprint() {
		StringBuilder all = new StringBuilder();
		texts.forEach((label, text) -> all.append(label).append('\n').append(text).append('\n'));
		return all.toString();
	}

	private static String profile(IndexedSolution solution) {
		StringBuilder text = new StringBuilder("Name: ").append(solution.name());
		line(text, "Offered by", solution.organizationName());
		line(text, "Summary", solution.summary());
		line(text, "Problems solved", solution.problemsSolved());
		line(text, "Value proposition", solution.valueProposition());
		line(text, "Traction", solution.traction());
		line(text, "Best customer profile", solution.bestCustomerProfile());
		line(text, "Maturity", solution.maturity());
		line(text, "Focus areas", String.join(", ", solution.focusAreas()));
		line(text, "Industries", String.join(", ", solution.industries()));
		line(text, "Built with", String.join(", ", solution.builtWith()));
		line(text, "Deployment", String.join(", ", solution.deployment()));
		return text.toString();
	}

	private static void line(StringBuilder text, String label, @Nullable String value) {
		if (value != null && !value.isBlank()) {
			text.append('\n').append(label).append(": ").append(value.strip());
		}
	}

}
