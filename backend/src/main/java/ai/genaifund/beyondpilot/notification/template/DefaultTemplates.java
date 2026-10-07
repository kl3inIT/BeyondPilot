package ai.genaifund.beyondpilot.notification.template;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * The wording BeyondPilot ships, one file per kind under {@code notification/templates}: a {@code subject:} line, a
 * {@code ---} line, then the Markdown body. Startup fails when a file is missing or does not pass the checks an
 * operator's edit must pass, so a default can always be rendered.
 */
@Component
public class DefaultTemplates {

	private static final String SUBJECT = "subject: ";

	private static final String SEPARATOR = "\n---\n";

	private final Map<EmailKind, EmailTemplate> templates = new EnumMap<>(EmailKind.class);

	DefaultTemplates() throws IOException {
		for (EmailKind kind : EmailKind.values()) {
			EmailTemplate template = read(kind);
			List<TemplateProblem> problems = TemplateSyntax.problems(kind, template);
			if (!problems.isEmpty()) {
				throw new IllegalStateException("The default template of " + kind.value() + " is invalid: " + problems);
			}
			templates.put(kind, template);
		}
	}

	public EmailTemplate template(EmailKind kind) {
		return templates.get(kind);
	}

	private static EmailTemplate read(EmailKind kind) throws IOException {
		String path = "notification/templates/" + kind.value() + ".md";
		String content;
		try (InputStream in = new ClassPathResource(path).getInputStream()) {
			content = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
		}
		int separator = content.indexOf(SEPARATOR);
		if (!content.startsWith(SUBJECT) || separator < 0) {
			throw new IllegalStateException(path + " must start with a subject line and a --- line");
		}
		return new EmailTemplate(content.substring(SUBJECT.length(), separator).strip(),
				content.substring(separator + SEPARATOR.length()).strip());
	}

}
