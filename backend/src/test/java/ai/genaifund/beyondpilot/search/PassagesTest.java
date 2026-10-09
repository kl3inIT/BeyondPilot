package ai.genaifund.beyondpilot.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

/** How a page's text becomes passages: nothing reworded, nothing longer than one vector should carry. */
class PassagesTest {

	@Test
	void aSlideStaysOnePassageAndAPageWithoutTextGivesNone() {
		assertThat(Passages.cut("Spectron\r\nAI-Powered Quality Inspection Platform\r\n")).containsExactly(
				"Spectron\nAI-Powered Quality Inspection Platform");
		assertThat(Passages.cut("  \n\f \n")).isEmpty();
	}

	@Test
	void aLongPageIsCutAtLineEndsAndKeepsEveryLineInOrder() {
		List<String> lines = IntStream.range(0, 120)
			.mapToObj(number -> "Line " + number + " says what the product does for its customers.")
			.toList();

		List<String> passages = Passages.cut(String.join("\n", lines));

		assertThat(passages).hasSizeGreaterThan(2).allSatisfy(
				passage -> assertThat(passage.length()).isLessThanOrEqualTo(Passages.PASSAGE_CHARACTERS));
		// Joined again, the passages are the page: a quote found in one is the page's own words.
		assertThat(passages.stream().flatMap(String::lines).collect(Collectors.toList())).isEqualTo(lines);
	}

	@Test
	void aLineLongerThanAPassageIsCutAtASpace() {
		String line = "word ".repeat(1000).strip();

		List<String> passages = Passages.cut(line);

		assertThat(passages).hasSizeGreaterThan(1)
			.allSatisfy(passage -> assertThat(passage).doesNotStartWith(" ").endsWith("word"));
		assertThat(String.join(" ", passages)).isEqualTo(line);
	}

	@Test
	void aRunawayPageIsReadOnlyToItsLimit() {
		String page = ("A line of a page that never ends.\n").repeat(2000);

		List<String> passages = Passages.cut(page);

		assertThat(passages.stream().mapToInt(String::length).sum()).isLessThanOrEqualTo(Passages.PAGE_CHARACTERS);
	}

}
