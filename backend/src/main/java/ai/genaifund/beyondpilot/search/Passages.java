package ai.genaifund.beyondpilot.search;

import java.util.ArrayList;
import java.util.List;

/**
 * Cuts the text of one page into passages short enough for one vector to mean one thing. A slide of a deck is short
 * and stays whole; a web page is cut at line ends, and a line longer than a passage at a space. Text is never
 * reworded: a passage is a run of the page exactly as it was extracted, so a quote found in it is the vendor's own.
 */
final class Passages {

	/** About 500 tokens: MemoryOS cuts at 768 tokens under a heading; a page here has no headings to cut by. */
	static final int PASSAGE_CHARACTERS = 2000;

	/** A page is read up to here; what is beyond is left out, as a runaway page would fill the index alone. */
	static final int PAGE_CHARACTERS = 20_000;

	private Passages() {
	}

	/** The passages of a page, in order; none for a page without text. */
	static List<String> cut(String page) {
		String text = page.replace("\r\n", "\n").replace('\r', '\n').strip();
		if (text.length() > PAGE_CHARACTERS) {
			text = text.substring(0, PAGE_CHARACTERS);
		}
		List<String> passages = new ArrayList<>();
		StringBuilder current = new StringBuilder();
		for (String line : text.split("\n")) {
			String rest = line.stripTrailing();
			while (rest.length() > PASSAGE_CHARACTERS) {
				flush(current, passages);
				int space = rest.lastIndexOf(' ', PASSAGE_CHARACTERS);
				int end = space > PASSAGE_CHARACTERS / 2 ? space : PASSAGE_CHARACTERS;
				passages.add(rest.substring(0, end).strip());
				rest = rest.substring(end).strip();
			}
			if (current.length() + rest.length() + 1 > PASSAGE_CHARACTERS) {
				flush(current, passages);
			}
			if (!rest.isBlank() || current.length() > 0) {
				current.append(rest).append('\n');
			}
		}
		flush(current, passages);
		return passages;
	}

	private static void flush(StringBuilder current, List<String> passages) {
		String passage = current.toString().strip();
		if (!passage.isEmpty()) {
			passages.add(passage);
		}
		current.setLength(0);
	}

}
