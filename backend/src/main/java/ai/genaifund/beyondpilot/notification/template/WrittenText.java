package ai.genaifund.beyondpilot.notification.template;

import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.web.util.HtmlUtils;

/**
 * Text an operator wrote in full, such as the message of an outcome: escaped, its line breaks kept, and with its links.
 * A link is written {@code [its words](https://…)}, and a web address on its own links to itself. {@code {name}} fills
 * in another value of the email once the links are read, so a value, which may be a name an applicant chose, can never
 * become a link.
 */
final class WrittenText {

	/**
	 * A link with its words, or a web address on its own. An address ends before a space, a bracket or the punctuation
	 * a sentence closes with.
	 */
	private static final Pattern LINK = Pattern.compile(
			"\\[([^\\[\\]\\n]+)\\]\\((https?://[^\\s()<>]+)\\)|(https?://[^\\s()<>\\[\\]]*[^\\s()<>\\[\\].,;:!?'\"])");

	private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)\\}");

	private WrittenText() {
	}

	/** As HTML with inline styles: the links in the accent color, a line break where the text has one. */
	static String html(String text, Map<String, ?> values, String accentColor) {
		return render(text, values, words -> HtmlUtils.htmlEscape(words).replace("\n", "<br>"),
				(words, url) -> "<a href=\"" + HtmlUtils.htmlEscape(url) + "\" style=\"color:" + accentColor
						+ ";text-decoration:underline;\">" + words + "</a>");
	}

	/** As plain text: a link's words with its address after them. */
	static String text(String text, Map<String, ?> values) {
		return render(text, values, Function.identity(), (words, url) -> words.equals(url) ? url : words + " (" + url + ")");
	}

	private interface LinkWriter {

		String write(String words, String url);

	}

	private static String render(String written, Map<String, ?> values, Function<String, String> words,
			LinkWriter link) {
		String text = written.strip();
		StringBuilder out = new StringBuilder();
		Matcher matcher = LINK.matcher(text);
		int end = 0;
		while (matcher.find()) {
			out.append(words.apply(fill(text.substring(end, matcher.start()), values)));
			String url = matcher.group(2) != null ? matcher.group(2) : matcher.group(3);
			String label = matcher.group(1) != null ? fill(matcher.group(1), values) : url;
			out.append(link.write(words.apply(label), url));
			end = matcher.end();
		}
		out.append(words.apply(fill(text.substring(end), values)));
		return out.toString();
	}

	/** Fills in each {@code {name}} the email has a value for; any other is left as written. */
	private static String fill(String text, Map<String, ?> values) {
		return PLACEHOLDER.matcher(text).replaceAll(match -> {
			Object value = values.get(match.group(1));
			return Matcher.quoteReplacement(value instanceof String filled ? filled : match.group());
		});
	}

}
