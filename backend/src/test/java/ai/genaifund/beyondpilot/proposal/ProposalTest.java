package ai.genaifund.beyondpilot.proposal;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Applying to a program over real HTTP against PostgreSQL: a draft saved step by step, a submission with its version
 * and its email, a change submitted again, withdrawing, and what is refused. Only the SMTP server is replaced.
 */
class ProposalTest extends ApplicationsHttpTest {

	@Test
	void anIndividualAppliesChangesItSubmitsAgainAndWithdraws() {
		Form form = program("claims-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String email = "dat@individual.test";
		String applicant = TestSignIn.session(client, mail, email);

		String empty = body(get(applicant, form.path()).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(empty, "$.application")).isNull();
		assertThat(JsonPath.<Object>read(empty, "$.organization")).isNull();
		assertThat(JsonPath.<Boolean>read(empty, "$.program.open")).isTrue();
		assertThat(JsonPath.<List<String>>read(empty, "$.program.questions[*].kind")).containsExactly("long_text",
				"single_choice", "file", "confirm");

		// A draft keeps what the form holds, whatever is missing.
		String draft = body(put(applicant, form.path(), application(Map.of("firstName", "Dat"), null, Map.of(), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(draft, "$.application.status")).isEqualTo("draft");
		String id = JsonPath.read(draft, "$.application.id");
		assertProblem(post(applicant, API + "/applications/" + id + "/submit", null), 400,
				"PROPOSAL_ORGANIZATION_REQUIRED");

		// On their own, a person applies through an organization made from their name, which waits for review.
		String organized = body(post(applicant, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Dat Phan", "country", "VN"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(organized, "$.organization.name")).isEqualTo("Dat Phan");
		assertThat(JsonPath.<String>read(organized, "$.organization.type")).isEqualTo("independent_builder");
		assertThat(JsonPath.<Boolean>read(organized, "$.organization.approved")).isFalse();
		UUID solution = completeSolution(applicant, email, "Claim Copilot");

		String saved = body(put(applicant, form.path(),
				withDeck(application(contact(), solution, answers(form, email), versionOf(organized)), email))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Integer>read(saved, "$.application.files.length()")).isEqualTo(1);
		assertThat(JsonPath.<String>read(saved, "$.application.deck.fileName")).isEqualTo("proposal.pdf");
		assertThat(JsonPath.<List<String>>read(saved, "$.application.builtWith")).containsExactly("OpenAI GPT",
				"Whisper");
		String deck = JsonPath.read(saved, "$.application.deck.fileId");
		String submitted = body(post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(submitted, "$.application.status")).isEqualTo("submitted");
		assertThat(JsonPath.<Integer>read(submitted, "$.application.submissions")).isEqualTo(1);
		assertThat(mail.latestSubjectTo(email)).isEqualTo("Application submitted: Claims challenge");
		assertThat(snapshotName(id, 1)).isEqualTo("Dat Phan");

		// It can change until the close; each submission is a version, and the earlier one stays as it was.
		Map<String, String> changed = answers(form, email);
		changed.put(form.direction().toString(), "Carrying");
		Map<String, Object> change = application(contact(), solution, changed, versionOf(submitted));
		change.put("deckFileId", deck);
		put(applicant, form.path(), change).expectStatus().isOk();
		String again = body(post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(again, "$.application.submissions")).isEqualTo(2);
		assertThat(answerOf(id, 1, form.direction())).isEqualTo("Claiming");
		assertThat(answerOf(id, 2, form.direction())).isEqualTo("Carrying");

		String withdrawn = body(post(applicant, API + "/applications/" + id + "/withdraw", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(withdrawn, "$.application.status")).isEqualTo("withdrawn");
		String mine = body(get(applicant, API + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].programName")).containsExactly("Claims challenge");
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].status")).containsExactly("withdrawn");
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].solutionName")).containsExactly("Claim Copilot");
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].next.title")).containsExactly("Demo day");
		assertProblem(get(TestSignIn.session(client, mail, "other@individual.test"), API + "/applications/" + id), 404,
				"PROPOSAL_APPLICATION_NOT_FOUND");

		// The next application starts from what this one held, the deck included.
		Form next = program("next-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String fresh = body(get(applicant, next.path()).expectStatus().isOk());
		assertThat(JsonPath.<String>read(fresh, "$.previous.deck.fileId")).isEqualTo(deck);
		assertThat(JsonPath.<String>read(fresh, "$.previous.contact.lastName")).isEqualTo("Phan");
		assertThat(JsonPath.<String>read(fresh, "$.previous.traction")).isEqualTo("Two pilots with insurers.");
	}

	@Test
	void aSubmissionNeedsEverythingTheProgramAsks() {
		Form form = program("needs-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String email = "team@needs.test";
		String applicant = TestSignIn.session(client, mail, email);
		String organized = body(post(applicant, form.path() + "/organization",
				Map.of("kind", "team", "name", "Pocket Policy", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(organized, "$.organization.type")).isEqualTo("builder_team");
		UUID solution = completeSolution(applicant, email, "Policy Chat");

		Map<String, String> answers = answers(form, email);
		answers.remove(form.confirmation().toString());
		String draft = body(put(applicant, form.path(), application(contact(), solution, answers, null)).expectStatus()
			.isOk());
		String id = JsonPath.read(draft, "$.application.id");
		String submit = API + "/applications/" + id + "/submit";
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_TEAM_BACKGROUND_REQUIRED");

		Map<String, Object> withBackground = application(contact(), solution, answers, versionOf(draft));
		withBackground.put("teamBackground", "Two engineers from an insurer.");
		String noDeck = body(put(applicant, form.path(), withBackground).expectStatus().isOk());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_DECK_REQUIRED");
		Map<String, Object> withDeck = withDeck(application(contact(), solution, answers, versionOf(noDeck)), email);
		withDeck.put("teamBackground", "Two engineers from an insurer.");
		String saved = body(put(applicant, form.path(), withDeck).expectStatus().isOk());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_ANSWER_REQUIRED");

		Map<String, String> wrongChoice = answers(form, email);
		wrongChoice.put(form.direction().toString(), "Somewhere else");
		assertProblem(put(applicant, form.path(), application(contact(), solution, wrongChoice, versionOf(saved))), 400,
				"PROPOSAL_ANSWER_INVALID");
		Map<String, String> borrowedFile = answers(form, email);
		borrowedFile.put(form.proposalFile().toString(), file("operator@proposal.test").toString());
		assertProblem(put(applicant, form.path(), application(contact(), solution, borrowedFile, versionOf(saved))), 404,
				"STORAGE_FILE_NOT_FOUND");

		Map<String, Object> noPhone = application(Map.of("firstName", "Dat", "lastName", "Phan"), solution,
				answers(form, email), versionOf(saved));
		noPhone.put("teamBackground", "Two engineers from an insurer.");
		String partial = body(put(applicant, form.path(), noPhone).expectStatus().isOk());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_CONTACT_INCOMPLETE");

		String bare = body(post(applicant, "/api/solution/mine", Map.of("name", "Bare Desk")).expectStatus()
			.isCreated());
		Map<String, Object> bareSolution = application(contact(), UUID.fromString(JsonPath.read(bare, "$.id")),
				answers(form, email), versionOf(partial));
		bareSolution.put("teamBackground", "Two engineers from an insurer.");
		put(applicant, form.path(), bareSolution).expectStatus().isOk();
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_SOLUTION_INCOMPLETE");
	}

	@Test
	void nothingIsSavedOutsideTheWindowAndASubmissionIsFinalWhereTheProgramSaysSo() {
		Form closed = program("closed-challenge", true, Instant.now().minus(Duration.ofMinutes(1)));
		String applicant = TestSignIn.session(client, mail, "late@window.test");
		assertThat(JsonPath.<Boolean>read(body(get(applicant, closed.path()).expectStatus().isOk()), "$.program.open"))
			.isFalse();
		assertProblem(put(applicant, closed.path(), application(Map.of(), null, Map.of(), null)), 409,
				"PROPOSAL_CLOSED");
		assertProblem(get(applicant, API + "/programs/no-such-program/application"), 409, "PROPOSAL_NOT_OPEN");

		Form fixed = program("final-challenge", false, Instant.now().plus(Duration.ofDays(10)));
		String email = "final@window.test";
		String early = TestSignIn.session(client, mail, email);
		post(early, fixed.path() + "/organization", Map.of("kind", "individual", "name", "Final Builder", "country",
				"SG"))
			.expectStatus()
			.isOk();
		UUID solution = completeSolution(early, email, "Final Desk");
		String draft = body(put(early, fixed.path(),
				withDeck(application(contact(), solution, answers(fixed, email), null), email))
			.expectStatus()
			.isOk());
		String submitted = body(post(early, API + "/applications/" + JsonPath.read(draft, "$.application.id")
				+ "/submit", null)
			.expectStatus()
			.isOk());
		assertProblem(put(early, fixed.path(), application(contact(), solution, answers(fixed, email),
				versionOf(submitted))), 409, "PROPOSAL_LOCKED");
	}

	@Test
	void oneOrganizationAppliesOnceToAProgram() {
		Form form = program("company-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String founderEmail = "founder@company.test";
		String founder = TestSignIn.session(client, mail, founderEmail);
		String company = body(post(founder, "/api/organization/organizations",
				Map.of("name", "Company Co", "type", "company", "country", "VN", "teamSize", "10_49",
						"industries", List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated());
		String organizationId = JsonPath.read(company, "$.id");
		post(operator, "/api/organization/admin/organizations/" + organizationId + "/approve", Map.of("emailDomain", "company.test")).expectStatus()
			.isNoContent();
		UUID solution = completeSolution(founder, founderEmail, "Company Desk");
		submitted(founder, founderEmail, form, solution);

		String colleagueEmail = "colleague@company.test";
		String colleague = TestSignIn.session(client, mail, colleagueEmail);
		// A work address joins at once only while the owners allow it.
		put(founder, "/api/organization/mine/auto-join", Map.of("autoJoin", true)).expectStatus().isNoContent();
		post(colleague, "/api/organization/organizations/" + organizationId + "/join", Map.of()).expectStatus().isOk();
		Map<String, Object> second = withDeck(application(contact(), solution, answers(form, colleagueEmail), null),
				colleagueEmail);
		second.put("teamBackground", "The same company.");
		String draft = body(put(colleague, form.path(), second).expectStatus().isOk());
		assertProblem(post(colleague, API + "/applications/" + JsonPath.read(draft, "$.application.id") + "/submit",
				null), 409, "PROPOSAL_ORGANIZATION_APPLIED");
	}

}
