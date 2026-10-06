package ai.genaifund.beyondpilot.proposal;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;

/**
 * Reviewing a program's applications over real HTTP against PostgreSQL: its criteria, the judges GenAI Fund invites,
 * their scores, the decisions and the release of the outcomes.
 */
class ReviewTest extends ApplicationsHttpTest {

	private static final String REVIEW = API + "/review/programs/";

	@Test
	void anOperatorSetsTheCriteriaAndInvitesAJudgeWhoSignsInWithThatAddress() {
		Form form = program("judged-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String criteria = REVIEW + form.programId() + "/criteria";
		String reviewers = REVIEW + form.programId() + "/reviewers";
		String judgeEmail = "judge@review.test";
		String early = TestSignIn.session(client, mail, judgeEmail);
		assertProblem(get(early, criteria), 403, "PROPOSAL_REVIEW_NOT_ALLOWED");

		String saved = body(put(operator, criteria, criteria("Practical impact", "Credible execution"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<List<String>>read(saved, "$.criteria[*].name")).containsExactly("Practical impact",
				"Credible execution");
		assertThat(JsonPath.<Boolean>read(saved, "$.fixed")).isFalse();
		assertProblem(put(operator, criteria, criteria("Impact", "impact")), 400, "PROPOSAL_CRITERIA_INVALID");

		String invited = body(post(operator, reviewers, Map.of("email", judgeEmail)).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(invited, "$.items[*].status")).containsExactly("invited");
		assertThat(mail.latestSubjectTo(judgeEmail)).isEqualTo("Judge the applications to Judged challenge");
		assertThat(mail.latestTextTo(judgeEmail)).doesNotContain("http");
		assertProblem(post(operator, reviewers, Map.of("email", "JUDGE@review.test")), 409,
				"PROPOSAL_REVIEWER_INVITED");

		// The person who signs in with the invited address reviews the program, and only reads its criteria.
		String judge = TestSignIn.session(client, mail, judgeEmail);
		String programs = body(get(judge, API + "/review/programs").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(programs, "$.items[*].name")).containsExactly("Judged challenge");
		assertThat(JsonPath.<List<String>>read(body(get(judge, criteria).expectStatus().isOk()), "$.criteria[*].name"))
			.containsExactly("Practical impact", "Credible execution");
		put(judge, criteria, criteria("Anything")).expectStatus().isForbidden();
		get(judge, reviewers).expectStatus().isForbidden();

		String joined = body(get(operator, reviewers).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(joined, "$.items[*].status")).containsExactly("active");
		String id = JsonPath.read(joined, "$.items[0].id");
		assertProblem(post(operator, reviewers + "/" + id + "/resend", null), 409, "PROPOSAL_REVIEWER_JOINED");

		// A removed judge no longer sees the program.
		delete(operator, reviewers + "/" + id).expectStatus().isOk();
		assertProblem(get(judge, criteria), 403, "PROPOSAL_REVIEW_NOT_ALLOWED");
		assertThat(JsonPath.<List<Object>>read(body(get(judge, API + "/review/programs").expectStatus().isOk()),
				"$.items")).isEmpty();
		assertThat(auditOf(form.programId())).contains("proposal.criteria_update", "proposal.reviewer_invite",
				"proposal.reviewer_remove");
	}

	@Test
	void anInvitationNobodyUsedLapsesAndCanBeSentAgain() {
		Form form = program("lapsing-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String reviewers = REVIEW + form.programId() + "/reviewers";
		String email = "late@review.test";
		String invited = body(post(operator, reviewers, Map.of("email", email)).expectStatus().isOk());
		String id = JsonPath.read(invited, "$.items[0].id");
		jdbc.sql("update proposal_reviewer set expires_at = now() - interval '1 minute' where program_id = ?")
			.params(form.programId())
			.update();
		assertThat(JsonPath.<List<String>>read(body(get(operator, reviewers).expectStatus().isOk()),
				"$.items[*].status")).containsExactly("lapsed");
		String late = TestSignIn.session(client, mail, email);
		assertProblem(get(late, REVIEW + form.programId() + "/criteria"), 403, "PROPOSAL_REVIEW_NOT_ALLOWED");

		post(operator, reviewers + "/" + id + "/resend", null).expectStatus().isOk();
		get(late, REVIEW + form.programId() + "/criteria").expectStatus().isOk();
	}

	@Test
	void judgesScoreOnTheCriteriaAndOnlyOperatorsReadEveryScore() {
		Form form = program("scored-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		List<String> criteria = criteriaOf(form, "Practical impact", "Credible execution");
		String judge = judge(form, "scorer@review.test");
		Applicant first = applicant(form, "first@scored.test", "First Builder");
		Applicant second = applicant(form, "second@scored.test", "Second Builder");
		String one = API + "/review/applications/" + first.id();
		String two = API + "/review/applications/" + second.id();

		String list = body(get(judge, REVIEW + form.programId() + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].organizationName")).containsExactly("First Builder",
				"Second Builder");
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].choice")).containsExactly("Claiming", "Claiming");
		assertThat(JsonPath.<List<Object>>read(list, "$.items[*].reviewStatus")).containsOnlyNulls();
		assertThat(JsonPath.<String>read(list, "$.head.choice.label")).isEqualTo("Direction");

		assertProblem(put(judge, one + "/assessment", scores(Map.of(criteria.get(0), 4))), 400,
				"PROPOSAL_ASSESSMENT_INVALID");
		assertProblem(put(judge, one + "/assessment", scores(Map.of(criteria.get(0), 6, criteria.get(1), 3))), 400,
				"PROPOSAL_ASSESSMENT_INVALID");
		String scored = body(put(judge, one + "/assessment", scores(Map.of(criteria.get(0), 4, criteria.get(1), 3)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Double>read(scored, "$.mine.average")).isEqualTo(3.5);
		assertThat(JsonPath.<Integer>read(scored, "$.mine.version")).isEqualTo(1);

		// An operator reads every score and the mean of them; a judge reads only their own.
		put(operator, one + "/assessment", scores(Map.of(criteria.get(0), 5, criteria.get(1), 5))).expectStatus().isOk();
		String read = body(get(operator, one).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(read, "$.others[*].role")).containsExactly("reviewer");
		assertThat(JsonPath.<Double>read(read, "$.average")).isEqualTo(4.3);
		String own = body(get(judge, one).expectStatus().isOk());
		assertThat(JsonPath.<List<Object>>read(own, "$.others")).isEmpty();
		assertThat(JsonPath.<Object>read(own, "$.average")).isNull();
		assertThat(JsonPath.<Object>read(own, "$.reviewStatus")).isNull();
		assertProblem(put(operator, REVIEW + form.programId() + "/criteria", criteria("Anything")), 409,
				"PROPOSAL_CRITERIA_FIXED");

		// A judge who knows the applicant steps back, and their score is left out.
		body(put(judge, two + "/assessment", Map.of("scores", Map.of(), "conflict", true)).expectStatus().isOk());
		String counted = body(get(operator, REVIEW + form.programId() + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<Integer>>read(counted, "$.items[*].scored")).containsExactly(2, 0);
		assertThat(JsonPath.<List<String>>read(body(get(judge, REVIEW + form.programId() + "/applications")
			.expectStatus()
			.isOk()), "$.items[*].mine")).containsExactly("scored", "conflict");

		// A score made before the applicant submitted again says the version it was made on.
		resubmit(form, first);
		String again = body(get(operator, one).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(again, "$.version")).isEqualTo(2);
		assertThat(JsonPath.<List<Integer>>read(again, "$.others[*].version")).containsExactly(1);
		assertProblem(get(judge, one + "/files/" + UUID.randomUUID()), 404, "PROPOSAL_APPLICATION_NOT_FOUND");
	}

	@Test
	void outcomesAreReleasedOnceAfterTheCloseAndEveryDecision() {
		Form form = program("released-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		criteriaOf(form, "Practical impact");
		String judge = judge(form, "decider@review.test");
		Applicant chosen = applicant(form, "chosen@released.test", "Chosen Builder");
		Applicant other = applicant(form, "other@released.test", "Other Builder");
		String decisions = REVIEW + form.programId() + "/decisions";
		String release = REVIEW + form.programId() + "/release";

		post(judge, decisions, decision(List.of(chosen.id()), "shortlisted")).expectStatus().isForbidden();
		post(operator, decisions, decision(List.of(chosen.id()), "shortlisted")).expectStatus().isOk();
		assertProblem(post(operator, release, emails()), 409, "PROPOSAL_OUTCOMES_NOT_READY");
		close(form);
		assertProblem(post(operator, release, emails()), 409, "PROPOSAL_OUTCOMES_NOT_READY");
		String waiting = body(get(operator, release).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(waiting, "$.ready")).isFalse();
		assertThat(JsonPath.<List<String>>read(waiting, "$.undecided[*].organizationName"))
			.containsExactly("Other Builder");

		post(operator, decisions, decision(List.of(other.id()), "not_selected")).expectStatus().isOk();
		assertThat(JsonPath.<Boolean>read(body(get(operator, release).expectStatus().isOk()), "$.ready")).isTrue();
		assertThat(JsonPath.<List<Object>>read(body(get(chosen.session(), API + "/applications").expectStatus().isOk()),
				"$.items[*].outcome")).containsOnlyNulls();

		post(operator, release, emails()).expectStatus().isOk();
		assertThat(mail.latestSubjectTo("chosen@released.test")).isEqualTo("Shortlisted: Released challenge");
		assertThat(mail.latestTextTo("chosen@released.test")).contains("Hi Chosen Builder");
		assertThat(mail.latestSubjectTo("other@released.test")).isEqualTo("Your application to Released challenge");
		assertThat(JsonPath.<List<String>>read(body(get(chosen.session(), API + "/applications").expectStatus().isOk()),
				"$.items[*].outcome")).containsExactly("shortlisted");
		assertThat(JsonPath.<String>read(body(get(other.session(), API + "/applications/" + other.id())
			.expectStatus()
			.isOk()), "$.application.outcome")).isEqualTo("not_selected");

		// It happens once, and the review no longer changes.
		assertProblem(post(operator, release, emails()), 409, "PROPOSAL_RELEASED");
		assertProblem(post(operator, decisions, decision(List.of(other.id()), "shortlisted")), 409, "PROPOSAL_RELEASED");
		String history = body(get(operator, API + "/review/applications/" + chosen.id()).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(history, "$.history[*].kind")).containsExactly("submitted", "decided");
		assertThat(JsonPath.<List<String>>read(history, "$.history[*].reason")).contains("The strongest in Claiming.");
		assertThat(auditOf(form.programId())).contains("proposal.decide", "proposal.release");
	}

	/** Sets a program's criteria and answers their identifiers in order. */
	private List<String> criteriaOf(Form form, String... names) {
		return JsonPath.read(body(put(operator, REVIEW + form.programId() + "/criteria", criteria(names))
			.expectStatus()
			.isOk()), "$.criteria[*].id");
	}

	/** A judge of the program, invited and signed in with the invited address. */
	private String judge(Form form, String email) {
		post(operator, REVIEW + form.programId() + "/reviewers", Map.of("email", email)).expectStatus().isOk();
		return TestSignIn.session(client, mail, email);
	}

	/** Someone on their own who submitted an application to the program. */
	private Applicant applicant(Form form, String email, String name) {
		String session = TestSignIn.session(client, mail, email);
		post(session, form.path() + "/organization", Map.of("kind", "individual", "name", name, "country", "VN"))
			.expectStatus()
			.isOk();
		UUID solution = completeSolution(session, email, name + " Desk");
		submitted(session, email, form, solution);
		String id = JsonPath.read(body(get(session, API + "/applications").expectStatus().isOk()), "$.items[0].id");
		return new Applicant(session, email, solution, UUID.fromString(id));
	}

	private void resubmit(Form form, Applicant applicant) {
		String view = body(get(applicant.session(), form.path()).expectStatus().isOk());
		Map<String, Object> change = application(contact(), applicant.solution(), answers(form, applicant.email()),
				versionOf(view));
		change.put("deckFileId", JsonPath.read(view, "$.application.deck.fileId"));
		put(applicant.session(), form.path(), change).expectStatus().isOk();
		post(applicant.session(), API + "/applications/" + applicant.id() + "/submit", null).expectStatus().isOk();
	}

	private static Map<String, Object> scores(Map<String, Integer> scores) {
		return Map.of("scores", scores, "note", "Clear on consent.", "conflict", false);
	}

	private static Map<String, Object> decision(List<UUID> ids, String decision) {
		return Map.of("applicationIds", ids, "decision", decision, "reason", "The strongest in Claiming.");
	}

	private static Map<String, String> emails() {
		return Map.of("shortlistedSubject", "Shortlisted: Released challenge", "shortlistedMessage",
				"Hi {organization},\n\n{solution} is shortlisted.", "notSelectedSubject",
				"Your application to Released challenge", "notSelectedMessage",
				"Hi {organization},\n\nNot this time.");
	}

	private record Applicant(String session, String email, UUID solution, UUID id) {
	}

	private static Map<String, Object> criteria(String... names) {
		return Map.of("criteria", List.of(names).stream().map(name -> Map.of("name", name)).toList());
	}
}
