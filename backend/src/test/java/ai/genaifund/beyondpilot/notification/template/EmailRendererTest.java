package ai.genaifund.beyondpilot.notification.template;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
		for (EmailKind kind : sentKinds()) {
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
	void theProposalEmailLinksToTheProposal() {
		String url = "https://beyondpilot.test/use-cases/42/propose/view";
		Map<String, Object> values = new HashMap<>();
		values.put("useCaseTitle", "Claims triage");
		values.put("organizationName", "Plain Cover");
		values.put("proposalUrl", url);

		RenderedEmail sent = renderer.render(EmailKind.PROPOSAL_SENT, defaults.template(EmailKind.PROPOSAL_SENT), values,
				APPEARANCE);
		assertThat(sent.subject()).isEqualTo("Proposal sent: Claims triage");
		assertThat(sent.html()).contains("href=\"" + url + "\"").contains("What happens next");
		assertThat(sent.text()).doesNotContain("named on its team");
	}

	@Test
	void theApplicationEmailsLinkToTheApplication() {
		String url = "https://beyondpilot.test/applications/42";
		Map<String, Object> values = new HashMap<>();
		values.put("programName", "Claims challenge");
		values.put("editableUntil", "15 Oct 2026, 23:59 ICT");
		values.put("applicationUrl", url);

		RenderedEmail received = renderer.render(EmailKind.APPLICATION_RECEIVED,
				defaults.template(EmailKind.APPLICATION_RECEIVED), values, APPEARANCE);
		assertThat(received.html()).containsPattern("<a [^>]*href=\"" + url + "\" style=\"display:inline-block;[^\"]*\">"
				+ "View your application</a>")
			.contains("until 15 Oct 2026, 23:59 ICT");
		assertThat(received.text()).contains(url);

		values.put("subject", "Shortlisted: Claims challenge");
		values.put("message", "Hi Minh,\n\nYour team is on the shortlist.");
		RenderedEmail outcome = renderer.render(EmailKind.APPLICATION_OUTCOME,
				defaults.template(EmailKind.APPLICATION_OUTCOME), values, APPEARANCE);
		assertThat(outcome.html()).contains("Hi Minh,<br><br>Your team is on the shortlist.")
			.contains("href=\"" + url + "\"");
		assertThat(outcome.text()).contains("Your team is on the shortlist.").contains(url);
	}

	@Test
	void theOutcomeMessageKeepsTheLinksTheOperatorWroteAndNoNameBecomesOne() {
		Map<String, Object> values = new HashMap<>();
		values.put("subject", "Shortlisted");
		values.put("message", """
				Hi {organization},

				Read the [Demo Day brief](https://docs.example/brief?a=1&b=2) before {solution} presents.
				Join on https://zoom.example/j/1. Or [this](javascript:alert(1)).""");
		values.put("organization", "<b>Evil</b> [win](https://evil.example)");
		values.put("solution", "https://evil.example/claim");
		values.put("applicationUrl", "https://beyondpilot.test/applications/42");

		RenderedEmail email = renderer.render(EmailKind.APPLICATION_OUTCOME,
				defaults.template(EmailKind.APPLICATION_OUTCOME), values, APPEARANCE);

		assertThat(email.html())
			.contains("<a href=\"https://docs.example/brief?a=1&amp;b=2\" style=\"color:#0070C0;text-decoration:underline;\">"
					+ "Demo Day brief</a>")
			.contains("<a href=\"https://zoom.example/j/1\" style=\"color:#0070C0;text-decoration:underline;\">"
					+ "https://zoom.example/j/1</a>.")
			.contains("Hi &lt;b&gt;Evil&lt;/b&gt; [win](https://evil.example),<br><br>")
			.contains("before https://evil.example/claim presents.")
			.doesNotContain("href=\"https://evil.example")
			.doesNotContain("href=\"javascript");
		assertThat(email.text()).contains("Read the Demo Day brief (https://docs.example/brief?a=1&b=2) before")
			.contains("Join on https://zoom.example/j/1.");
	}

	@Test
	void aWordingSavedBeforeAKindOfferedTheLinkIsStillValidAndStillRenders() {
		EmailTemplate saved = new EmailTemplate("We have your application to {{programName}}",
				"Thank you for applying to {{programName}}.{{#editableUntil}} Change it until {{editableUntil}}.{{/editableUntil}}");
		Map<String, Object> values = new HashMap<>();
		values.put("programName", "Claims challenge");
		values.put("applicationUrl", "https://beyondpilot.test/applications/42");

		assertThat(renderer.problems(EmailKind.APPLICATION_RECEIVED, saved)).isEmpty();
		RenderedEmail email = renderer.render(EmailKind.APPLICATION_RECEIVED, saved, values, APPEARANCE);
		assertThat(email.subject()).isEqualTo("We have your application to Claims challenge");
		assertThat(email.text()).startsWith("Thank you for applying to Claims challenge.")
			.doesNotContain("/applications/42");
	}

	@Test
	void everyLinkAKindOffersIsAButtonInItsDefaultWordingAndAWordingWithoutItStillRenders() {
		List<String> linked = new ArrayList<>();
		for (EmailKind kind : sentKinds()) {
			List<String> links = kind.variables()
				.stream()
				.filter(variable -> !variable.required() && variable.name().endsWith("Url"))
				.map(EmailKind.Variable::name)
				.toList();
			if (links.isEmpty()) {
				continue;
			}
			linked.add(kind.value());
			String url = "https://beyondpilot.test/opened/" + kind.value();
			Map<String, Object> values = new HashMap<>();
			kind.variables().forEach(variable -> values.put(variable.name(), variable.sample()));
			links.forEach(link -> values.put(link, url));

			RenderedEmail email = renderer.render(kind, defaults.template(kind), values, APPEARANCE);
			assertThat(email.html()).as(kind.value())
				.containsPattern("<a [^>]*href=\"" + url + "\" style=\"display:inline-block;[^\"]*\">[^<]+</a>");
			assertThat(email.text()).as(kind.value()).contains(url);

			// What an operator saved before the kind offered the link: the required variables and nothing else.
			EmailTemplate saved = new EmailTemplate("Saved wording", "Saved wording." + kind.variables()
				.stream()
				.filter(EmailKind.Variable::required)
				.map(variable -> " {{" + variable.name() + "}}")
				.collect(Collectors.joining()));
			assertThat(renderer.problems(kind, saved)).as(kind.value()).isEmpty();
			RenderedEmail kept = renderer.render(kind, saved, values, APPEARANCE);
			assertThat(kept.text()).as(kind.value()).startsWith("Saved wording.").doesNotContain(url);
		}
		assertThat(linked).containsExactlyInAnyOrder("consent_withdrawn", "organization_invitation",
				"organization_request_approved", "organization_restored",
				"application_received", "reviewer_invitation", "application_outcome", "solution_approved",
				"solution_sent_back", "solution_restored", "perk_request_waiting", "perk_request_granted",
				"perk_request_declined", "use_case_approved", "use_case_sent_back",
				"proposal_shortlisted", "proposal_declined", "matching_invitation",
				"talent_approved", "talent_changes_requested", "talent_restored", "message_request",
				"message_request_reminder", "message_request_accepted", "message_request_declined",
				"message_request_closed", "message_unread", "event_registration_received",
				"event_registration_waitlisted", "event_registration_confirmed",
				"event_registration_declined");
	}

	@Test
	void aValueIsEscapedAndNeverBecomesMarkupOrALink() {
		Map<String, Object> values = new HashMap<>();
		values.put("senderName", "<b>Mallory</b> **Claims**");
		values.put("senderOrganization", "[click me](https://evil.example)");
		values.put("about", "**Claims**");

		RenderedEmail email = renderer.render(EmailKind.MESSAGE_REQUEST, defaults.template(EmailKind.MESSAGE_REQUEST),
				values, APPEARANCE);

		assertThat(email.html()).contains("&lt;b&gt;Mallory&lt;/b&gt;")
			.contains("[click me](https://evil.example)")
			.doesNotContain("href=\"https://evil.example\"")
			.contains("**Claims**");

		// A text a person wrote is quoted with its lines kept and its markup shown as text.
		Map<String, Object> sentBack = new HashMap<>();
		sentBack.put("solutionName", "ClaimLens");
		sentBack.put("organizationName", "Plain Cover");
		sentBack.put("reason", "line one\nline two <script>");
		RenderedEmail quoted = renderer.render(EmailKind.SOLUTION_SENT_BACK,
				defaults.template(EmailKind.SOLUTION_SENT_BACK), sentBack, APPEARANCE);
		assertThat(quoted.html()).contains("line one<br>line two &lt;script&gt;").doesNotContain("<script>");
		assertThat(quoted.text()).contains("line one\nline two <script>");
	}

	@Test
	void anOptionalValueThatIsAbsentTakesItsOtherWording() {
		Map<String, Object> values = new HashMap<>();
		values.put("senderOrganization", "Pocket Policy");
		values.put("about", "ClaimLens");

		RenderedEmail email = renderer.render(EmailKind.MESSAGE_REQUEST, defaults.template(EmailKind.MESSAGE_REQUEST),
				values, APPEARANCE);

		assertThat(email.text()).contains("Someone (Pocket Policy) wrote to you on BeyondPilot about ClaimLens");
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

	private static List<EmailKind> sentKinds() {
		return Arrays.stream(EmailKind.values()).filter(kind -> !kind.retired()).toList();
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
