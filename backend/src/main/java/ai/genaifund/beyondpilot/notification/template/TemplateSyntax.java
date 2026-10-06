package ai.genaifund.beyondpilot.notification.template;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import com.samskivert.mustache.BasicCollector;
import com.samskivert.mustache.Mustache;
import com.samskivert.mustache.MustacheException;
import com.samskivert.mustache.Template;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Heading;
import org.commonmark.node.Link;
import org.commonmark.node.ListItem;
import org.commonmark.node.Node;
import org.commonmark.node.OrderedList;
import org.commonmark.node.Paragraph;
import org.commonmark.node.StrongEmphasis;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.commonmark.renderer.text.LineBreakRendering;
import org.commonmark.renderer.text.TextContentRenderer;
import org.springframework.web.util.HtmlUtils;

/**
 * Turns a template into text: Markdown first, then the values. Converting the Markdown before filling in the values
 * means a value, which may be what a visitor typed, can never become a link or markup.
 *
 * <p>
 * Templates are Mustache without logic: a tag names a value, a section shows its text when a value is present. Values
 * are reached as entries of a map and never by reflection, so a template cannot call into the application, and only
 * the plain tags below are accepted.
 */
final class TemplateSyntax {

	/** Unescaped output, partials, delimiter changes and the inheritance tags of later Mustache versions. */
	private static final Pattern FORBIDDEN_TAG = Pattern.compile("\\{\\{\\s*[{&>=<$]");

	private static final Mustache.Collector MAP_ONLY = new BasicCollector() {

		@Override
		public <K, V> Map<K, V> createFetcherCache() {
			return new ConcurrentHashMap<>();
		}

	};

	private static final Mustache.Compiler HTML = compiler()
		.withEscaper(text -> HtmlUtils.htmlEscape(text).replace("\n", "<br>"));

	private static final Mustache.Compiler PLAIN = compiler().escapeHTML(false);

	private static final Parser MARKDOWN = Parser.builder().build();

	private static final TextContentRenderer TEXT = TextContentRenderer.builder()
		.lineBreakRendering(LineBreakRendering.SEPARATE_BLOCKS)
		.build();

	private TemplateSyntax() {
	}

	private static Mustache.Compiler compiler() {
		return Mustache.compiler()
			.withCollector(MAP_ONLY)
			.withLoader(name -> {
				throw new MustacheException("Templates include no other template: " + name);
			})
			.nullValue("")
			.emptyStringIsFalse(true);
	}

	/** What keeps the template from being used for the kind; empty when it can be saved. */
	static List<TemplateProblem> problems(EmailKind kind, EmailTemplate template) {
		Set<String> offered = new LinkedHashSet<>();
		kind.variables().stream().filter(variable -> !variable.quoted()).forEach(variable -> offered.add(variable.name()));
		List<TemplateProblem> problems = new ArrayList<>();
		Set<String> used = new LinkedHashSet<>();
		if (template.subject().isBlank() || template.subject().contains("\n")) {
			problems.add(new TemplateProblem(TemplateProblem.Type.SUBJECT_LINE, "subject", null));
		}
		check("subject", template.subject(), offered, used, problems);
		check("body", template.body(), offered, used, problems);
		for (EmailKind.Variable variable : kind.variables()) {
			if (variable.required() && !used.contains(variable.name())) {
				problems.add(new TemplateProblem(TemplateProblem.Type.MISSING_VARIABLE, "body", variable.name()));
			}
		}
		return problems;
	}

	private static void check(String field, String text, Set<String> offered, Set<String> used,
			List<TemplateProblem> problems) {
		if (FORBIDDEN_TAG.matcher(text).find()) {
			problems.add(new TemplateProblem(TemplateProblem.Type.SYNTAX, field, null));
			return;
		}
		Template template;
		try {
			template = PLAIN.compile(text);
		}
		catch (MustacheException exception) {
			problems.add(new TemplateProblem(TemplateProblem.Type.SYNTAX, field, null));
			return;
		}
		Set<String> unknown = new LinkedHashSet<>();
		template.visit(new Mustache.Visitor() {

			@Override
			public void visitText(String text) {
			}

			@Override
			public void visitVariable(String name) {
				name(name);
			}

			@Override
			public boolean visitInclude(String name) {
				unknown.add(name);
				return false;
			}

			@Override
			public boolean visitSection(String name) {
				name(name);
				return true;
			}

			@Override
			public boolean visitInvertedSection(String name) {
				name(name);
				return true;
			}

			private void name(String name) {
				if (offered.contains(name)) {
					used.add(name);
				}
				else {
					unknown.add(name);
				}
			}

		});
		unknown.forEach(name -> problems.add(new TemplateProblem(TemplateProblem.Type.UNKNOWN_VARIABLE, field, name)));
	}

	/** The subject with the values filled in, as one line. */
	static String subject(EmailTemplate template, Map<String, ?> values) {
		return PLAIN.compile(template.subject()).execute(values).strip().replaceAll("\\s+", " ");
	}

	/**
	 * The body as HTML with inline styles, which is what mail clients read. Two lines read as more than text: a line
	 * that is only bold, such as a code, stands out in a box; a line that is only a link becomes a button.
	 */
	static String html(String markdown, Map<String, ?> values, String accentColor) {
		Node document = MARKDOWN.parse(markdown);
		HtmlRenderer renderer = HtmlRenderer.builder()
			.escapeHtml(true)
			.sanitizeUrls(true)
			.attributeProviderFactory(context -> (node, tagName, attributes) -> {
				String style = switch (node) {
					case Paragraph paragraph when alone(paragraph, StrongEmphasis.class) -> "margin:8px 0 24px 0;";
					case Paragraph paragraph when alone(paragraph, Link.class) -> "margin:8px 0 24px 0;";
					case Paragraph paragraph -> "margin:0 0 16px 0;";
					case StrongEmphasis strong when alone(strong.getParent(), StrongEmphasis.class) -> HIGHLIGHT;
					case Link link when alone(link.getParent(), Link.class) -> button(accentColor);
					case Link link -> "color:" + accentColor + ";text-decoration:underline;";
					case Heading heading -> heading.getLevel() == 1 ? "margin:0 0 16px 0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.3px;"
							: "margin:0 0 12px 0;font-size:19px;line-height:28px;font-weight:600;";
					case BulletList list -> "margin:0 0 16px 0;padding:0 0 0 22px;";
					case OrderedList list -> "margin:0 0 16px 0;padding:0 0 0 22px;";
					case ListItem item -> "margin:0 0 6px 0;";
					case BlockQuote quote -> "margin:0 0 16px 0;padding:0 0 0 16px;border-left:3px solid #E3EAF2;color:#4B5D75;";
					default -> null;
				};
				if (style != null) {
					attributes.put("style", style);
				}
			})
			.build();
		return HTML.compile(renderer.render(document)).execute(values);
	}

	private static final String HIGHLIGHT = "display:block;text-align:center;padding:18px 24px;background-color:#F6F9FC;"
			+ "border:1px solid #E3EAF2;border-radius:10px;font-family:'SF Mono',Menlo,Consolas,'Liberation Mono',monospace;"
			+ "font-size:30px;line-height:36px;font-weight:600;letter-spacing:6px;color:#0B1B2E;";

	private static String button(String accentColor) {
		return "display:inline-block;padding:12px 22px;background-color:" + accentColor + ";border-radius:8px;"
				+ "font-size:15px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;";
	}

	/** Whether the node holds exactly one child, of the type given. */
	private static boolean alone(Node node, Class<? extends Node> child) {
		Node first = node.getFirstChild();
		return first != null && first == node.getLastChild() && child.isInstance(first);
	}

	/** The body as plain text, paragraphs apart. */
	static String text(String markdown, Map<String, ?> values) {
		return PLAIN.compile(TEXT.render(MARKDOWN.parse(markdown))).execute(values).strip();
	}

	/** A value written as it is: escaped, its line breaks kept. */
	static String quoteHtml(String text) {
		return HtmlUtils.htmlEscape(text.strip()).replace("\n", "<br>");
	}

}
