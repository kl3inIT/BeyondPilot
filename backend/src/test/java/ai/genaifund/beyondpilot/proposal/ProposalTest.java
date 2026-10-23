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

	@Autowired
	private ReviewService review;

	@Test
	void anApplicantWhoDeclinesAiIsLeftOutOfTheAiEvaluation() {
		Form form = program("private-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String email = "private@individual.test";
		String applicant = TestSignIn.session(client, mail, email);
		String draft = body(put(applicant, form.path(), application(Map.of("firstName", "Lan"), null, Map.of(), null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(draft, "$.application.id");
		String organized = body(post(applicant, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Lan Vo", "country", "VN"))
			.expectStatus()
			.isOk());
		UUID solution = completeSolution(applicant, email, "Quiet Copilot");
		put(applicant, form.path(),
				withDeck(application(contact(), solution, answers(form, email), versionOf(organized)), email))
			.expectStatus()
			.isOk();
		post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk();
		UUID program = UUID.fromString(JsonPath.read(draft, "$.program.id"));
		assertThat(review.submissionsTo(program)).extracting(ProgramSubmission::id).contains(UUID.fromString(id));

		client.put()
			.uri("/api/identity/consent")
			.cookie(TestSignIn.SESSION_COOKIE, applicant)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("platform", true, "partners", true, "ai", false, "updates", false, "source", "settings"))
			.exchange()
			.expectStatus()
			.isOk();

		assertThat(review.submissionsTo(program)).extracting(ProgramSubmission::id)
			.doesNotContain(UUID.fromString(id));
		// People still review it.
		assertThat(JsonPath.<String>read(body(get(applicant, API + "/applications/" + id).expectStatus().isOk()),
				"$.application.status")).isEqualTo("submitted");
	}

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
				"single_choice", "file", "confirm", "multi_choice");

		// A draft keeps what the form holds, whatever is missing.
		String draft = body(put(applicant, form.path(), application(Map.of("firstName", "Dat"), null, Map.of(), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(draft, "$.application.status")).isEqualTo("draft");
		String id = JsonPath.read(draft, "$.application.id");
		assertProblem(post(applicant, API + "/applications/" + id + "/submit", null), 400,
				"PROPOSAL_ORGANIZATION_REQUIRED");

		// On their own, a person applies through an organization made from their name, which nobody reviews.
		String organized = body(post(applicant, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Dat Phan", "country", "VN"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(organized, "$.organization.name")).isEqualTo("Dat Phan");
		assertThat(JsonPath.<String>read(organized, "$.organization.type")).isEqualTo("independent_builder");
		assertThat(JsonPath.<Boolean>read(organized, "$.organization.active")).isTrue();
		UUID solution = completeSolution(applicant, email, "Claim Copilot");

		String saved = body(put(applicant, form.path(),
				withDeck(application(contact(), solution, answers(form, email), versionOf(organized)), email))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Integer>read(saved, "$.application.files.length()")).isEqualTo(1);
		assertThat(JsonPath.<String>read(saved, "$.application.answers['" + form.areas() + "']"))
			.isEqualTo("[\"Claims\",\"Pricing\"]");
		assertThat(JsonPath.<String>read(saved, "$.application.deck.fileName")).isEqualTo("proposal.pdf");
		assertThat(JsonPath.<List<String>>read(saved, "$.application.builtWith")).containsExactly("OpenAI GPT",
				"Whisper");
		String deck = JsonPath.read(saved, "$.application.deck.fileId");
		String submitted = body(post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(submitted, "$.application.status")).isEqualTo("submitted");
		assertThat(JsonPath.<Integer>read(submitted, "$.application.submissions")).isEqualTo(1);
		assertThat(mail.latestSubjectTo(email)).isEqualTo("Application submitted: Claims challenge");
		// The copy leads back to the application, at the site's own address.
		assertThat(mail.latestTextTo(email)).containsPattern("https?://[^/ ]+/applications/" + id);
		assertThat(snapshotName(id, 1)).isEqualTo("Dat Phan");
		// The account keeps the country and the number of a first submission, for the next form to start from.
		String me = body(get(applicant, "/api/identity/me").expectStatus().isOk());
		assertThat(JsonPath.<String>read(me, "$.country")).isEqualTo("VN");
		assertThat(JsonPath.<String>read(me, "$.phone")).isEqualTo("+84 912 345 678");

		// It can change until the close; each submission is a version, and the earlier one stays as it was.
		Map<String, String> changed = answers(form, email);
		changed.put(form.direction().toString(), "Carrying");
		// Several choices are kept in the order the question offers them, however the form sent them.
		changed.put(form.areas().toString(), "[\"Fraud\",\"Claims\"]");
		Map<String, Object> change = application(contact(), solution, changed, versionOf(submitted));
		change.put("deckFileId", deck);
		put(applicant, form.path(), change).expectStatus().isOk();
		String again = body(post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(again, "$.application.submissions")).isEqualTo(2);
		assertThat(answerOf(id, 1, form.direction())).isEqualTo("Claiming");
		assertThat(answerOf(id, 2, form.direction())).isEqualTo("Carrying");
		assertThat(answerOf(id, 1, form.areas())).isEqualTo("[\"Claims\",\"Pricing\"]");
		assertThat(answerOf(id, 2, form.areas())).isEqualTo("[\"Claims\",\"Fraud\"]");

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
	void someoneOnTheirOwnKeepsTheNameTheyGaveAndMayApplyOtherwiseUntilTheySendSomething() {
		Form form = program("alone-challenge", true, Instant.now().plus(Duration.ofDays(10)));

		// The organization keeps the name given to it, whatever the application's contact says, and a team can still be
		// chosen instead.
		String lan = TestSignIn.session(client, mail, "lan@alone.test");
		String alone = body(post(lan, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Lan Nguyen", "country", "VN"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(alone, "$.organization.changeable")).isTrue();
		String renamed = body(put(lan, form.path(),
				application(Map.of("firstName", " Lan", "lastName", "Tran "), null, Map.of(), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(renamed, "$.organization.name")).isEqualTo("Lan Nguyen");
		String team = body(post(lan, form.path() + "/organization",
				Map.of("kind", "team", "name", "Lan and Friends", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(team, "$.organization.name")).isEqualTo("Lan and Friends");
		assertThat(JsonPath.<String>read(team, "$.organization.type")).isEqualTo("builder_team");
		assertThat(JsonPath.<Boolean>read(team, "$.organization.active")).isTrue();
		// A team that is just them may still change while it sent nothing: renamed, or back to themselves, in place.
		assertThat(JsonPath.<Boolean>read(team, "$.organization.changeable")).isTrue();
		String id = JsonPath.read(team, "$.organization.id");
		String lab = body(post(lan, form.path() + "/organization",
				Map.of("kind", "team", "name", "Lan Lab", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(lab, "$.organization.name")).isEqualTo("Lan Lab");
		assertThat(JsonPath.<String>read(lab, "$.organization.id")).isEqualTo(id);
		String back = body(post(lan, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Lan Nguyen", "country", "VN"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(back, "$.organization.type")).isEqualTo("independent_builder");
		assertThat(JsonPath.<String>read(back, "$.organization.name")).isEqualTo("Lan Nguyen");
		assertThat(JsonPath.<String>read(back, "$.organization.id")).isEqualTo(id);
		assertThat(JsonPath.<Boolean>read(back, "$.organization.changeable")).isTrue();

		// A team that is just them leaves for a company; nobody is then offered to join the team left empty.
		String an = TestSignIn.session(client, mail, "an@alone.test");
		post(an, form.path() + "/organization",
				Map.of("kind", "team", "name", "Quiet Harbor", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk();
		String finder = "/api/organization/organizations?q=harbor";
		String other = TestSignIn.session(client, mail, "finder@alone.test");
		assertThat(JsonPath.<List<String>>read(body(get(other, finder).expectStatus().isOk()), "$.items[*].name"))
			.containsExactly("Quiet Harbor");
		String gone = body(post(an, form.path() + "/organization/leave", null).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(gone, "$.organization")).isNull();
		assertThat(JsonPath.<List<String>>read(body(get(other, finder).expectStatus().isOk()), "$.items")).isEmpty();

		// A team stays one once someone else may be in it: here, someone invited.
		String tuan = TestSignIn.session(client, mail, "tuan@alone.test");
		post(tuan, form.path() + "/organization",
				Map.of("kind", "team", "name", "Tuan Team", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk();
		post(tuan, "/api/organization/mine/invitations", Map.of("email", "friend@alone.test", "role", "member"))
			.expectStatus()
			.isNoContent();
		assertThat(JsonPath.<Boolean>read(body(get(tuan, form.path()).expectStatus().isOk()),
				"$.organization.changeable")).isFalse();
		assertProblem(post(tuan, form.path() + "/organization/leave", null), 409, "PROPOSAL_INDIVIDUAL_LOCKED");
		assertProblem(post(tuan, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Tuan Do", "country", "VN")), 409, "PROPOSAL_INDIVIDUAL_LOCKED");

		// Leaving leaves the application with no organization, to join or add a company.
		String minh = TestSignIn.session(client, mail, "minh@alone.test");
		post(minh, form.path() + "/organization", Map.of("kind", "individual", "name", "Minh Le", "country", "VN"))
			.expectStatus()
			.isOk();
		put(minh, form.path(), application(contact(), null, Map.of(), null)).expectStatus().isOk();
		String left = body(post(minh, form.path() + "/organization/leave", null).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(left, "$.organization")).isNull();
		assertThat(jdbc.sql("select organization_id is null from proposal where account_id = (select id from"
				+ " identity_account where email = 'minh@alone.test')").query(Boolean.class).single()).isTrue();

		// Once something went out under their name, they keep applying as themselves.
		String email = "hoa@alone.test";
		String hoa = TestSignIn.session(client, mail, email);
		post(hoa, form.path() + "/organization", Map.of("kind", "individual", "name", "Hoa Pham", "country", "VN"))
			.expectStatus()
			.isOk();
		submitted(hoa, email, form, completeSolution(hoa, email, "Hoa Copilot"));
		String sent = body(get(hoa, form.path()).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(sent, "$.organization.changeable")).isFalse();
		assertProblem(post(hoa, form.path() + "/organization/leave", null), 409, "PROPOSAL_INDIVIDUAL_LOCKED");
		assertProblem(post(hoa, form.path() + "/organization",
				Map.of("kind", "team", "name", "Hoa Team", "country", "VN", "teamSize", "2_9")), 409,
				"PROPOSAL_INDIVIDUAL_LOCKED");

		// One GenAI Fund took down keeps that decision: neither a team nor a fresh start undoes it.
		String khanh = TestSignIn.session(client, mail, "khanh@alone.test");
		post(khanh, form.path() + "/organization", Map.of("kind", "individual", "name", "Khanh Vo", "country", "VN"))
			.expectStatus()
			.isOk();
		jdbc.sql("update organization set suspended_at = now() where name = 'Khanh Vo'").update();
		assertProblem(post(khanh, form.path() + "/organization/leave", null), 409, "PROPOSAL_INDIVIDUAL_LOCKED");
		assertProblem(post(khanh, form.path() + "/organization",
				Map.of("kind", "team", "name", "Khanh Team", "country", "VN", "teamSize", "2_9")), 409,
				"PROPOSAL_INDIVIDUAL_LOCKED");
	}

	@Test
	void someoneOnTheirOwnWhoBecomesATeamStaysApprovedAndKeepsTheirApplication() {
		Form form = program("stays-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String lan = TestSignIn.session(client, mail, "lan@stays.test");
		post(lan, form.path() + "/organization", Map.of("kind", "individual", "name", "Lan Stays", "country", "VN"))
			.expectStatus()
			.isOk();
		put(lan, form.path(), application(contact(), null, Map.of(), null)).expectStatus().isOk();

		String team = body(post(lan, form.path() + "/organization",
				Map.of("kind", "team", "name", "Lan Stays Team", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk());

		assertThat(JsonPath.<Boolean>read(team, "$.organization.active")).isTrue();
		assertThat(jdbc.sql("select status from organization where name = 'Lan Stays Team'")
			.query(String.class)
			.single()).isEqualTo("active");
		assertThat(jdbc.sql("""
				select o.name from proposal p join organization o on o.id = p.organization_id
				where p.account_id = (select id from identity_account where email = 'lan@stays.test')
				""").query(String.class).single()).isEqualTo("Lan Stays Team");
	}

	@Test
	void anApplicantDeletesADraftForGoodWithTheFilesNothingElseNames() {
		Form first = program("first-draft-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		Form second = program("second-draft-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String email = "mai@drafts.test";
		String mai = TestSignIn.session(client, mail, email);
		String draft = body(put(mai, first.path(),
				withDeck(application(Map.of("firstName", "Mai"), null, answers(first, email), null), email))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(draft, "$.application.id");
		UUID deck = UUID.fromString(JsonPath.read(draft, "$.application.deck.fileId"));
		UUID proposalFile = UUID.fromString(JsonPath.read(draft, "$.application.answers['" + first.proposalFile() + "']"));
		// The next application brings the same deck, then that program closes.
		Map<String, Object> next = application(Map.of("firstName", "Mai"), null, Map.of(), null);
		next.put("deckFileId", deck.toString());
		String other = JsonPath.read(body(put(mai, second.path(), next).expectStatus().isOk()), "$.application.id");
		jdbc.sql("update program set applications_close_at = now() - interval '1 minute' where id = ?")
			.params(second.programId())
			.update();

		assertProblem(delete(TestSignIn.session(client, mail, "stranger@drafts.test"), API + "/applications/" + id),
				404, "PROPOSAL_APPLICATION_NOT_FOUND");
		delete(mai, API + "/applications/" + id).expectStatus().isNoContent();
		assertProblem(get(mai, API + "/applications/" + id), 404, "PROPOSAL_APPLICATION_NOT_FOUND");
		assertThat(stored(proposalFile)).isFalse();
		// The other application still names the deck.
		assertThat(stored(deck)).isTrue();

		// A program that closed still lets its draft go.
		delete(mai, API + "/applications/" + other).expectStatus().isNoContent();
		assertThat(stored(deck)).isFalse();

		// A submitted application is withdrawn instead, and stays so once changed again.
		String sent = "sent@drafts.test";
		String sender = TestSignIn.session(client, mail, sent);
		post(sender, first.path() + "/organization", Map.of("kind", "individual", "name", "Sent Le", "country", "VN"))
			.expectStatus()
			.isOk();
		submitted(sender, sent, first, completeSolution(sender, sent, "Sent Copilot"));
		String submittedId = JsonPath.read(body(get(sender, first.path()).expectStatus().isOk()), "$.application.id");
		assertProblem(delete(sender, API + "/applications/" + submittedId), 409, "PROPOSAL_DRAFT_ONLY");
		String withdrawn = body(post(sender, API + "/applications/" + submittedId + "/withdraw", null).expectStatus()
			.isOk());
		Map<String, Object> changed = application(contact(), null, Map.of(), versionOf(withdrawn));
		assertThat(JsonPath.<String>read(body(put(sender, first.path(), changed).expectStatus().isOk()),
				"$.application.status")).isEqualTo("draft");
		assertProblem(delete(sender, API + "/applications/" + submittedId), 409, "PROPOSAL_DRAFT_ONLY");
	}

	private boolean stored(UUID file) {
		return jdbc.sql("select exists (select 1 from storage_file where id = ?)").param(file).query(Boolean.class).single();
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

		// A required question answered by several choices needs at least one.
		Map<String, String> noAreas = answers(form, email);
		noAreas.remove(form.areas().toString());
		Map<String, Object> withoutAreas = withDeck(application(contact(), solution, noAreas, versionOf(saved)), email);
		withoutAreas.put("teamBackground", "Two engineers from an insurer.");
		saved = body(put(applicant, form.path(), withoutAreas).expectStatus().isOk());
		assertThat(JsonPath.<Map<String, String>>read(saved, "$.application.answers"))
			.doesNotContainKey(form.areas().toString());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_ANSWER_REQUIRED");
		// Each choice is one of the question's options, exactly as written and named once.
		for (String wrong : List.of("[\"Claims\",\"Somewhere else\"]", "[\"claims\"]", "[\"Claims\",\"Claims\"]", "[]",
				"[null]", "Claims")) {
			Map<String, String> wrongChoices = answers(form, email);
			wrongChoices.put(form.areas().toString(), wrong);
			assertProblem(put(applicant, form.path(), application(contact(), solution, wrongChoices, versionOf(saved))),
					400, "PROPOSAL_ANSWER_INVALID");
		}

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
		String incomplete = body(put(applicant, form.path(), bareSolution).expectStatus().isOk());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_SOLUTION_INCOMPLETE");

		// A LinkedIn profile is the one contact detail a submission may leave out.
		Map<String, Object> noLinkedin = withDeck(application(Map.of("firstName", "Dat", "lastName", "Phan", "phone",
				"+84 912 345 678", "country", "VN"), solution, answers(form, email), versionOf(incomplete)), email);
		noLinkedin.put("teamBackground", "Two engineers from an insurer.");
		put(applicant, form.path(), noLinkedin).expectStatus().isOk();
		assertThat(JsonPath.<String>read(body(post(applicant, submit, null).expectStatus().isOk()),
				"$.application.status"))
			.isEqualTo("submitted");
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

		// Withdrawing is still possible, but it is final: submitting again would be a change by another name.
		String id = JsonPath.read(submitted, "$.application.id");
		post(early, API + "/applications/" + id + "/withdraw", null).expectStatus().isOk();
		assertProblem(post(early, API + "/applications/" + id + "/submit", null), 409, "PROPOSAL_WITHDRAWN_FOR_GOOD");
		String withdrawn = body(get(early, fixed.path()).expectStatus().isOk());
		assertProblem(put(early, fixed.path(), application(contact(), solution, answers(fixed, email),
				versionOf(withdrawn))), 409, "PROPOSAL_WITHDRAWN_FOR_GOOD");
		assertThat(JsonPath.<List<Boolean>>read(body(get(early, API + "/applications").expectStatus().isOk()),
				"$.items[*].allowUpdatesUntilClose")).containsExactly(false);
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
		String detail = "/api/organization/admin/organizations/" + organizationId;
		int version = JsonPath.<Integer>read(body(get(operator, detail).expectStatus().isOk()), "$.organization.version");
		Map<String, Object> profile = Map.of("name", "Company Co", "type", "company", "country", "VN", "teamSize",
				"10_49", "industries", List.of("insurance"), "website", "https://example.test", "description",
				"Assistants for insurers.", "foundedYear", 2021, "version", version);
		put(operator, detail, Map.of("profile", profile, "emailDomain", "company.test")).expectStatus().isOk();
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
