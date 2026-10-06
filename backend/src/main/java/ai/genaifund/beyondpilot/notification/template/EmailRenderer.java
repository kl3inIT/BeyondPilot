package ai.genaifund.beyondpilot.notification.template;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.samskivert.mustache.Mustache;
import com.samskivert.mustache.Template;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Renders an email of a kind from its template and its values into the fixed layout. The layout is BeyondPilot's own
 * markup in {@code notification/layout.html}: table-based with inline styles, which is what mail clients read, and it
 * takes only the appearance's values from the settings. Email is written in English.
 */
@Component
public class EmailRenderer {

	private static final int PREHEADER_LENGTH = 110;

	private final Template layout;

	EmailRenderer() throws IOException {
		try (InputStream in = new ClassPathResource("notification/layout.html").getInputStream()) {
			// The layout is trusted markup, so it may place the rendered body unescaped; its values are still escaped.
			this.layout = Mustache.compiler()
				.nullValue("")
				.emptyStringIsFalse(true)
				.compile(new String(in.readAllBytes(), StandardCharsets.UTF_8));
		}
	}

	/**
	 * @param template the kind's wording, an operator's or the default
	 * @param values every variable of the kind; null for one that is absent
	 */
	public RenderedEmail render(EmailKind kind, EmailTemplate template, Map<String, ?> values, Appearance appearance) {
		Map<String, @Nullable Object> filled = new HashMap<>();
		kind.variables().forEach(variable -> filled.put(variable.name(), values.get(variable.name())));
		String quote = kind.quote() == null ? null : (String) filled.get(kind.quote());
		return render(template, filled, quote, "note".equals(kind.quote()) ? "From GenAI Fund" : "Their message",
				appearance);
	}

	/** BeyondPilot's own message, such as a connection test, in the same layout and without variables. */
	public RenderedEmail render(EmailTemplate template, Appearance appearance) {
		return render(template, Map.of(), null, "", appearance);
	}

	private RenderedEmail render(EmailTemplate template, Map<String, ?> filled, @Nullable String quote,
			String quoteLabel, Appearance appearance) {
		String subject = TemplateSyntax.subject(template, filled);
		StringBuilder text = new StringBuilder(TemplateSyntax.text(template.body(), filled));
		boolean quoted = quote != null && !quote.isBlank();
		if (quoted) {
			text.append("\n\n").append(quoteLabel).append(":\n\n").append(quote.strip());
		}
		text.append("\n\nThe BeyondPilot team at GenAI Fund\n\n--\n").append(appearance.footer().strip()).append('\n');

		Map<String, @Nullable Object> page = new HashMap<>();
		page.put("subject", subject);
		page.put("preheader", preheader(text.toString()));
		page.put("accentColor", appearance.accentColor());
		page.put("logoUrl", appearance.logoUrl());
		page.put("logoOnDarkUrl", appearance.logoOnDarkUrl());
		page.put("siteUrl", appearance.siteUrl());
		page.put("siteHost", appearance.siteHost());
		page.put("body", TemplateSyntax.html(template.body(), filled, appearance.accentColor()));
		page.put("quote", quoted ? TemplateSyntax.quoteHtml(quote) : null);
		page.put("quoteLabel", quoteLabel);
		page.put("footer", TemplateSyntax.quoteHtml(appearance.footer()));
		return new RenderedEmail(subject, layout.execute(page), text.toString());
	}

	/** Whether the template may be saved for the kind, and if not, why. */
	public List<TemplateProblem> problems(EmailKind kind, EmailTemplate template) {
		return TemplateSyntax.problems(kind, template);
	}

	/** The first words of the text, which a mailbox shows after the subject. */
	private static String preheader(String text) {
		String line = text.replaceAll("[#*_]", "").replaceAll("\\s+", " ").strip();
		return line.length() <= PREHEADER_LENGTH ? line : line.substring(0, PREHEADER_LENGTH).strip() + "…";
	}

}
