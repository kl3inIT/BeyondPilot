package ai.genaifund.beyondpilot.notification.template;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Rendering and checking templates: what an operator may write, and that a value can never turn into markup. Plain
 * unit tests over the real templates and layout.
 */
class EmailRendererTest {

	private static final Appearance APPEARANCE = new Appearance("#0070C0", "Footer note.", "https://beyondpilot.test/");

	private final EmailRenderer renderer = renderer();

	private final DefaultTemplates defaults = defaults();

	@Test
	void everyDefaultTemplateRendersWithItsSampleValues() {
		for (EmailKind kind : EmailKind.values()) {
			Map<String, Object> samples = new HashMap<>();
			kind.variables().forEach(variable -> samples.put(variable.name(), variable.sample()));

			RenderedEmail email = renderer.render(kind, defaults.template(kind), samples, APPEARANCE);

			assertThat(email.subject()).as(kind.value()).isNotBlank().doesNotContain("{{").doesNotContain("\n");
			assertThat(email.html()).as(kind.value()).doesNotContain("{{").contains("https://beyondpilot.test/brand/");
			assertThat(email.text()).as(kind.value()).doesNotContain("{{").contains("Footer note.");
		}
	}

	@Test
	void theSignInCodeStandsAloneInTheTextAndInABoxInTheHtml() {
		RenderedEmail email = renderer.render(EmailKind.SIGN_IN_CODE, defaults.template(EmailKind.SIGN_IN_CODE),
				Map.of("code", "482913", "minutes", "15"), APPEARANCE);

		assertThat(email.subject()).isEqualTo("482913 is your BeyondPilot sign-in code");
		assertThat(email.text()).containsPattern("(?m)^482913$");
		assertThat(email.html()).containsPattern("<strong style=\"display:block;[^\"]*\">482913</strong>");
	}

	@Test
	void aValueIsEscapedAndNeverBecomesMarkupOrALink() {
		Map<String, Object> values = new HashMap<>();
		values.put("senderName", "<b>Mallory</b>");
		values.put("senderOrganization", "[click me](https://evil.example)");
		values.put("solutionName", "**Claims**");
		values.put("message", "line one\nline two <script>");

		RenderedEmail email = renderer.render(EmailKind.INTRODUCTION_REQUEST,
				defaults.template(EmailKind.INTRODUCTION_REQUEST), values, APPEARANCE);

		assertThat(email.html()).contains("&lt;b&gt;Mallory&lt;/b&gt;")
			.contains("[click me](https://evil.example)")
			.doesNotContain("href=\"https://evil.example\"")
			.contains("**Claims**")
			.contains("line one<br>line two &lt;script&gt;")
			.doesNotContain("<script>");
		assertThat(email.text()).contains("Their message:").contains("line one\nline two <script>");
	}

	@Test
	void anOptionalValueThatIsAbsentTakesItsOtherWording() {
		Map<String, Object> values = new HashMap<>();
		values.put("senderOrganization", "Pocket Policy");
		values.put("solutionName", "ClaimLens");
		values.put("message", "Hello");

		RenderedEmail email = renderer.render(EmailKind.INTRODUCTION_REQUEST,
				defaults.template(EmailKind.INTRODUCTION_REQUEST), values, APPEARANCE);

		assertThat(email.text()).contains("Someone at Pocket Policy asked GenAI Fund");
	}

	@Test
	void aTemplateMayUseOnlyItsKindsVariablesAndMustKeepTheRequiredOnes() {
		List<TemplateProblem> problems = renderer.problems(EmailKind.SIGN_IN_CODE,
				new EmailTemplate("Your code", "Here it is: **{{codee}}** for {{minutes}} minutes, {{account.email}}"));

		assertThat(problems).containsExactlyInAnyOrder(
				new TemplateProblem(TemplateProblem.Type.UNKNOWN_VARIABLE, "body", "codee"),
				new TemplateProblem(TemplateProblem.Type.UNKNOWN_VARIABLE, "body", "account.email"),
				new TemplateProblem(TemplateProblem.Type.MISSING_VARIABLE, "body", "code"));
	}

	@Test
	void unescapedOutputPartialsAndDelimiterChangesAreRefused() {
		for (String body : List.of("{{{code}}} {{minutes}}", "{{&code}} {{minutes}}", "{{> header}} {{code}} {{minutes}}",
				"{{=<% %>=}} <% code %> {{minutes}}")) {
			assertThat(renderer.problems(EmailKind.SIGN_IN_CODE, new EmailTemplate("Code", body))).as(body)
				.contains(new TemplateProblem(TemplateProblem.Type.SYNTAX, "body", null));
		}
	}

	@Test
	void aSubjectIsOneLine() {
		assertThat(renderer.problems(EmailKind.SIGN_IN_CODE, new EmailTemplate("One\nTwo", "{{code}} {{minutes}}")))
			.contains(new TemplateProblem(TemplateProblem.Type.SUBJECT_LINE, "subject", null));
	}

	private static EmailRenderer renderer() {
		try {
			return new EmailRenderer();
		}
		catch (IOException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private static DefaultTemplates defaults() {
		try {
			return new DefaultTemplates();
		}
		catch (IOException exception) {
			throw new IllegalStateException(exception);
		}
	}

}
