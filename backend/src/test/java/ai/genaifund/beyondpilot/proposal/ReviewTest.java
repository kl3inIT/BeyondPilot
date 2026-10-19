package ai.genaifund.beyondpilot.proposal;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestPdf;
import ai.genaifund.beyondpilot.identity.TestAppConnection;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.shared.Workbooks;
import com.jayway.jsonpath.JsonPath;
import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.ImageContent;
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Reviewing a program's applications over real HTTP against PostgreSQL: its criteria, the judges GenAI Fund invites,
 * their scores, the decisions and the release of the outcomes.
 */
class ReviewTest extends ApplicationsHttpTest {

	private static final String REVIEW = API + "/review/programs/";

	@LocalServerPort
	private int port;

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
		// The email leads to the program's applications under Reviews.
		assertThat(mail.latestTextTo(judgeEmail))
			.containsPattern("https?://[^/ ]+/reviews/" + form.programId() + "(?![\\w/-])");
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
		// A judge reads only what GenAI Fund shortlisted.
		assertThat(JsonPath.<List<Object>>read(body(get(judge, REVIEW + form.programId() + "/applications")
			.expectStatus()
			.isOk()), "$.items")).isEmpty();
		assertProblem(get(judge, one), 404, "PROPOSAL_APPLICATION_NOT_FOUND");
		shortlist(form, first.id(), second.id());

		String list = body(get(judge, REVIEW + form.programId() + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].organizationName")).containsExactly("First Builder",
				"Second Builder");
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].choice")).containsExactly("Claiming", "Claiming");
		assertThat(JsonPath.<List<Object>>read(list, "$.items[*].reviewStatus")).containsOnlyNulls();
		assertThat(JsonPath.<List<Object>>read(list, "$.items[*].email")).containsOnlyNulls();
		assertThat(JsonPath.<List<String>>read(body(get(operator, REVIEW + form.programId() + "/applications")
			.expectStatus()
			.isOk()), "$.items[*].email")).containsExactly("first@scored.test", "second@scored.test");
		assertThat(JsonPath.<String>read(list, "$.head.choice.label")).isEqualTo("Direction");

		assertProblem(put(judge, one + "/assessment", scores(Map.of(criteria.get(0), 4))), 400,
				"PROPOSAL_ASSESSMENT_INVALID");
		assertProblem(put(judge, one + "/assessment", scores(Map.of(criteria.get(0), 11, criteria.get(1), 3))), 400,
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
		// A judge reads the submission without the applicant's contact details.
		assertThat(JsonPath.<Object>read(own, "$.submitted.email")).isNull();
		assertThat(JsonPath.<Object>read(own, "$.submitted.contact")).isNull();
		assertThat(JsonPath.<String>read(own, "$.submitted.organizationName")).isEqualTo("First Builder");
		assertThat(JsonPath.<String>read(body(get(operator, one).expectStatus().isOk()), "$.submitted.email"))
			.isEqualTo("first@scored.test");
		assertProblem(put(operator, REVIEW + form.programId() + "/criteria", criteria("Anything")), 409,
				"PROPOSAL_CRITERIA_FIXED");

		// A judge who knows the applicant steps back, and their score is left out.
		body(put(judge, two + "/assessment", Map.of("scores", Map.of(), "conflict", true, "bookmarked", false)).expectStatus().isOk());
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
		// An answer of several choices is read with its kind, as the applicant's form kept it.
		assertThat(JsonPath.<List<String>>read(again, "$.submitted.answers[?(@.kind == 'multi_choice')].value"))
			.containsExactly("[\"Claims\",\"Pricing\"]");
		assertProblem(get(judge, one + "/files/" + UUID.randomUUID()), 404, "PROPOSAL_APPLICATION_NOT_FOUND");

		// Opening a file of an application, inside the judge's own permission, is not audited.
		String deck = JsonPath.read(again, "$.submitted.deck.fileId");
		get(judge, one + "/files/" + deck);
		assertThat(auditOf(form.programId())).doesNotContain("proposal.file_open");
	}

	@Test
	void reviewersOpenTheDemoLinkASubmissionKept() {
		Form form = program("demo-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String judge = judge(form, "viewer@review.test");
		String session = TestSignIn.session(client, mail, "shown@demo.test");
		post(session, form.path() + "/organization", Map.of("kind", "individual", "name", "Shown Builder", "country", "VN"))
			.expectStatus()
			.isOk();
		UUID solution = completeSolution(session, "shown@demo.test", "Shown Desk", "https://shown.example/demo");
		// The applicant reads the link on the solution they apply with.
		assertThat(JsonPath.<List<String>>read(body(get(session, form.path()).expectStatus().isOk()),
				"$.solutions[*].demoUrl"))
			.containsExactly("https://shown.example/demo");
		submitted(session, "shown@demo.test", form, solution);
		String with = JsonPath.read(body(get(session, API + "/applications").expectStatus().isOk()), "$.items[0].id");
		Applicant without = applicant(form, "plain@demo.test", "Plain Builder");
		shortlist(form, UUID.fromString(with), without.id());

		assertThat(JsonPath.<String>read(body(get(judge, API + "/review/applications/" + with).expectStatus().isOk()),
				"$.submitted.demoUrl"))
			.isEqualTo("https://shown.example/demo");
		assertThat(JsonPath.<String>read(body(get(operator, API + "/review/applications/" + with).expectStatus().isOk()),
				"$.submitted.demoUrl"))
			.isEqualTo("https://shown.example/demo");
		assertThat(JsonPath.<Object>read(
				body(get(judge, API + "/review/applications/" + without.id()).expectStatus().isOk()), "$.submitted.demoUrl"))
			.isNull();

		// A submission made before snapshots kept the link holds no such key, and reads as one without a demo.
		jdbc.sql("update proposal_version set snapshot = snapshot #- '{solution,demoUrl}' where proposal_id = ?")
			.params(UUID.fromString(with))
			.update();
		assertThat(JsonPath.<Object>read(body(get(judge, API + "/review/applications/" + with).expectStatus().isOk()),
				"$.submitted.demoUrl"))
			.isNull();
	}

	@Test
	void anOperatorDownloadsTheApplicationsAndTheDownloadIsRecorded() {
		Form form = program("exported-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		criteriaOf(form, "Practical impact");
		String judge = judge(form, "reader@exported.test");
		Applicant first = applicant(form, "first@exported.test", "First Exporter");
		Applicant second = applicant(form, "second@exported.test", "Second Exporter");
		String export = REVIEW + form.programId() + "/applications/export";
		post(operator, REVIEW + form.programId() + "/decisions", decision(List.of(first.id()), "shortlisted"))
			.expectStatus()
			.isOk();

		// Only GenAI Fund takes the applicants' contact details out.
		post(judge, export, Map.of()).expectStatus().isForbidden();
		assertThat(auditOf(form.programId())).doesNotContain("proposal.export");

		String all = new String(post(operator, export + "?format=csv", Map.of()).expectStatus()
			.isOk()
			.expectHeader()
			.contentType("text/csv;charset=UTF-8")
			.expectHeader()
			.valueMatches("Content-Disposition",
					"attachment; filename=\"exported-challenge-applications-\\d{4}-\\d{2}-\\d{2}\\.csv\".*")
			.expectBody()
			.returnResult()
			.getResponseBody(), StandardCharsets.UTF_8);
		assertThat(all).startsWith("﻿Application,Organization,Organization type,Solution,First name,Last name,Email,");
		List<String> rows = all.lines().toList();
		assertThat(rows).hasSize(3);
		assertThat(rows.get(0)).contains(",Submitted at,Version,Review status,Outcome released,Scores,Average score");
		assertThat(rows.get(1)).startsWith(first.id() + ",First Exporter,")
			.contains(",First,Exporter,first@exported.test,+84 912 345 678,VN,")
			.contains(",Shortlisted,No,0,");
		assertThat(rows.get(2)).startsWith(second.id() + ",Second Exporter,").contains(",Under review,No,0,");

		// The list as it was narrowed is what the download holds, by default a workbook to read.
		byte[] one = post(operator, export, Map.of("applicationIds", List.of(second.id()))).expectStatus()
			.isOk()
			.expectHeader()
			.contentType(SpreadsheetFormat.XLSX_TYPE)
			.expectHeader()
			.valueMatches("Content-Disposition",
					"attachment; filename=\"exported-challenge-applications-\\d{4}-\\d{2}-\\d{2}\\.xlsx\".*")
			.expectBody()
			.returnResult()
			.getResponseBody();
		List<List<String>> sheet = Workbooks.rows(one);
		assertThat(sheet).hasSize(3);
		assertThat(sheet.get(0)).startsWith("Application", "Applicant", "Applicant", "Applicant", "Contact");
		assertThat(sheet.get(1)).startsWith("Application", "Organization", "Organization type", "Solution", "First name")
			.contains("Submitted at", "Review status", "Outcome released");
		assertThat(sheet.get(2)).startsWith(second.id().toString(), "Second Exporter")
			.contains("Second", "Exporter", "second@exported.test", "+84 912 345 678", "Under review", "No");
		assertThat(jdbc.sql("""
				select details ->> 'count' from audit_event where action = 'proposal.export' and resource_id = ?
				order by occurred_at
				""").params(form.programId().toString()).query(String.class).list()).containsExactly("2", "1");
	}

	@Test
	void anOperatorFollowsUpTheDraftsWithoutReadingWhatTheySay() {
		Form form = program("followed-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String judge = judge(form, "reader@drafted.test");
		applicant(form, "sent@drafted.test", "Sent Builder");
		// One person has only typed their name; another has their contact details and an answer.
		String early = TestSignIn.session(client, mail, "early@drafted.test");
		put(early, form.path(), application(Map.of("firstName", "Early"), null, Map.of(), null)).expectStatus().isOk();
		String later = TestSignIn.session(client, mail, "later@drafted.test");
		Map<String, String> answered = new HashMap<>();
		answered.put(form.approach().toString(), "Claims reach a decision without a hotline call.");
		put(later, form.path(), application(contact("Later Builder"), null, answered, null)).expectStatus().isOk();
		String drafts = REVIEW + form.programId() + "/drafts";

		// Judges never see drafts.
		get(judge, drafts).expectStatus().isForbidden();
		post(judge, drafts + "/export", null).expectStatus().isForbidden();

		String list = body(get(operator, drafts).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].email")).containsExactly("later@drafted.test",
				"early@drafted.test");
		assertThat(JsonPath.<String>read(list, "$.items[0].phone")).isEqualTo("+84 912 345 678");
		assertThat(JsonPath.<Boolean>read(list, "$.items[0].contactComplete")).isTrue();
		assertThat(JsonPath.<Integer>read(list, "$.items[0].requiredAnswered")).isEqualTo(1);
		assertThat(JsonPath.<Boolean>read(list, "$.items[1].contactComplete")).isFalse();
		assertThat(JsonPath.<Boolean>read(list, "$.items[1].solutionChosen")).isFalse();
		assertThat(JsonPath.<Integer>read(list, "$.requiredQuestions")).isPositive();
		// The list does not read out what a draft says; an operator opens one to read it, and no reading is audited.
		assertThat(list).doesNotContain("hotline");
		String draftId = JsonPath.read(list, "$.items[0].id");
		get(judge, REVIEW.replace("/programs/", "/drafts/") + draftId).expectStatus().isForbidden();
		String one = body(get(operator, REVIEW.replace("/programs/", "/drafts/") + draftId).expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.draft.email")).isEqualTo("later@drafted.test");
		assertThat(JsonPath.<List<String>>read(one, "$.draft.answers[*].value"))
			.containsExactly("Claims reach a decision without a hotline call.");
		assertThat(auditOf(form.programId())).doesNotContain("proposal.draft_open");

		String csv = new String(post(operator, drafts + "/export?format=csv", null).expectStatus()
			.isOk()
			.expectHeader()
			.valueMatches("Content-Disposition",
					"attachment; filename=\"followed-challenge-drafts-\\d{4}-\\d{2}-\\d{2}\\.csv\".*")
			.expectBody()
			.returnResult()
			.getResponseBody(), StandardCharsets.UTF_8);
		assertThat(csv).startsWith("﻿Draft,First name,Last name,Email,Phone,");
		List<String> lines = csv.lines().toList();
		assertThat(lines).hasSize(3);
		assertThat(lines.get(1)).contains(",Later,Builder,later@drafted.test,+84 912 345 678,").contains(",Yes,");
		assertThat(csv).doesNotContain("hotline");
		assertThat(jdbc.sql("""
				select details ->> 'count' from audit_event where action = 'proposal.drafts_export' and resource_id = ?
				""").params(form.programId().toString()).query(String.class).list()).containsExactly("2");
	}

	@Test
	void weightedCriteriaTurnScoresIntoPointsAndANoteNeedsNoScore() {
		Form form = program("points-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String criteria = REVIEW + form.programId() + "/criteria";
		assertProblem(put(operator, criteria, Map.of("criteria", List.of(Map.of("name", "Impact", "maxPoints", 20),
				Map.of("name", "Execution")))), 400, "PROPOSAL_CRITERIA_POINTS_INVALID");
		put(operator, criteria, Map.of("criteria", List.of(Map.of("name", "Impact", "maxPoints", 0))))
			.expectStatus()
			.isBadRequest();
		put(operator, criteria, Map.of("criteria", List.of(Map.of("name", "Impact", "maxPoints", 105))))
			.expectStatus()
			.isBadRequest();
		String saved = body(put(operator, criteria, Map.of("criteria",
				List.of(Map.of("name", "Impact", "maxPoints", 20), Map.of("name", "Execution", "maxPoints", 5))))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<List<Integer>>read(saved, "$.criteria[*].maxPoints")).containsExactly(20, 5);
		List<String> ids = JsonPath.read(saved, "$.criteria[*].id");

		String judge = judge(form, "pointer@review.test");
		Applicant applicant = applicant(form, "points@scored.test", "Points Builder");
		shortlist(form, applicant.id());
		String one = API + "/review/applications/" + applicant.id();
		// A judge who scores after every pitch keeps a note and a bookmark first; it is still theirs to score.
		put(judge, one + "/assessment", Map.of("scores", Map.of(), "note", "Strong demo.", "conflict", false,
				"bookmarked", true))
			.expectStatus()
			.isOk();
		String noted = body(get(judge, REVIEW + form.programId() + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(noted, "$.items[*].mine")).containsExactly("noted");
		assertThat(JsonPath.<List<Boolean>>read(noted, "$.items[*].bookmarked")).containsExactly(true);
		assertThat(JsonPath.<List<Integer>>read(body(get(operator, REVIEW + form.programId() + "/applications")
			.expectStatus()
			.isOk()), "$.items[*].scored")).containsExactly(0);
		assertProblem(put(judge, one + "/assessment", scores(Map.of(ids.get(0), 4))), 400,
				"PROPOSAL_ASSESSMENT_INVALID");
		// A note fixes nothing: the criteria change until a score is saved.
		assertThat(JsonPath.<Boolean>read(body(get(operator, criteria).expectStatus().isOk()), "$.fixed")).isFalse();

		// A judge rates quality and never reads the weights: their own score is the mean of their scores.
		assertThat(JsonPath.<List<Object>>read(body(get(judge, criteria).expectStatus().isOk()),
				"$.criteria[*].maxPoints")).containsOnlyNulls();
		assertThat(JsonPath.<List<Object>>read(noted, "$.head.criteria[*].maxPoints")).containsOnlyNulls();
		String scored = body(put(judge, one + "/assessment", scores(Map.of(ids.get(0), 4, ids.get(1), 3)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Double>read(scored, "$.mine.average")).isEqualTo(3.5);
		assertThat(JsonPath.<List<Object>>read(scored, "$.head.criteria[*].maxPoints")).containsOnlyNulls();

		// For GenAI Fund, 4 of 10 on a 20-point criterion gives 8, 3 of 10 on a 5-point one gives 1.5.
		String read = body(get(operator, one).expectStatus().isOk());
		assertThat(JsonPath.<List<Double>>read(read, "$.others[*].average")).containsExactly(9.5);
		put(operator, one + "/assessment", scores(Map.of(ids.get(0), 10, ids.get(1), 10))).expectStatus().isOk();
		assertThat(JsonPath.<Double>read(body(get(operator, one).expectStatus().isOk()), "$.average")).isEqualTo(17.3);
	}

	@Test
	void outcomesAreReleasedOnceAfterTheCloseAndEveryDecision() {
		Form form = program("released-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		List<String> criteria = criteriaOf(form, "Practical impact");
		String judge = judge(form, "decider@review.test");
		Applicant chosen = applicant(form, "chosen@released.test", "Chosen Builder");
		Applicant other = applicant(form, "other@released.test", "Other Builder");
		String decisions = REVIEW + form.programId() + "/decisions";
		String release = REVIEW + form.programId() + "/release";

		post(judge, decisions, decision(List.of(chosen.id()), "shortlisted")).expectStatus().isForbidden();
		post(operator, decisions, decision(List.of(chosen.id()), "shortlisted")).expectStatus().isOk();
		// A judge reads which applications are shortlisted, and nothing else of the decisions.
		String listed = body(get(judge, REVIEW + form.programId() + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<Boolean>>read(listed, "$.items[*].shortlisted")).containsExactly(true);
		assertThat(JsonPath.<List<Object>>read(listed, "$.items[*].reviewStatus")).containsOnlyNulls();
		assertThat(JsonPath.<Boolean>read(body(get(judge, API + "/review/applications/" + chosen.id())
			.expectStatus()
			.isOk()), "$.shortlisted")).isTrue();
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
		assertThat(mail.latestTextTo("chosen@released.test")).contains("Hi Chosen Builder")
			.containsPattern("https?://[^/ ]+/applications/" + chosen.id());
		assertThat(mail.latestSubjectTo("other@released.test")).isEqualTo("Your application to Released challenge");
		assertThat(JsonPath.<List<String>>read(body(get(chosen.session(), API + "/applications").expectStatus().isOk()),
				"$.items[*].outcome")).containsExactly("shortlisted");
		assertThat(JsonPath.<String>read(body(get(other.session(), API + "/applications/" + other.id())
			.expectStatus()
			.isOk()), "$.application.outcome")).isEqualTo("not_selected");

		// It happens once, and the decisions no longer change; the shortlist is still judged, as at a demo day.
		assertProblem(post(operator, release, emails()), 409, "PROPOSAL_RELEASED");
		assertProblem(post(operator, decisions, decision(List.of(other.id()), "shortlisted")), 409, "PROPOSAL_RELEASED");
		put(judge, API + "/review/applications/" + chosen.id() + "/assessment", scores(Map.of(criteria.get(0), 4)))
			.expectStatus()
			.isOk();
		assertProblem(put(judge, API + "/review/applications/" + other.id() + "/assessment",
				scores(Map.of(criteria.get(0), 4))), 404, "PROPOSAL_APPLICATION_NOT_FOUND");
		assertProblem(put(operator, API + "/review/applications/" + other.id() + "/assessment",
				scores(Map.of(criteria.get(0), 4))), 409, "PROPOSAL_RELEASED");
		String history = body(get(operator, API + "/review/applications/" + chosen.id()).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(history, "$.history[*].kind")).containsExactly("submitted", "decided");
		assertThat(JsonPath.<List<String>>read(history, "$.history[*].reason")).contains("The strongest in Claiming.");
		assertThat(auditOf(form.programId())).contains("proposal.decide", "proposal.release");
	}

	@Test
	void theEmailsOfAReleaseAreKeptAsTheyAreWrittenUntilTheRelease() {
		Form form = program("drafted-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		criteriaOf(form, "Practical impact");
		String judge = judge(form, "drafter@review.test");
		Applicant chosen = applicant(form, "chosen@drafted.test", "Drafted Builder");
		String release = REVIEW + form.programId() + "/release";
		String draft = release + "/draft";

		// Until someone writes, the emails are the starting point in the words of the program.
		String starting = body(get(operator, release).expectStatus().isOk());
		assertThat(JsonPath.<String>read(starting, "$.emails.shortlistedSubject"))
			.isEqualTo("You're shortlisted for Drafted challenge");
		// The layout signs every email, so the message does not.
		assertThat(JsonPath.<String>read(starting, "$.emails.shortlistedMessage"))
			.contains("shortlisted for Drafted challenge.")
			.doesNotContain("GenAI Fund");
		assertThat(JsonPath.<String>read(starting, "$.emails.notSelectedMessage")).doesNotContain("GenAI Fund");

		// Only an operator writes them, and what is written is there when the page is opened again.
		put(judge, draft, emails()).expectStatus().isForbidden();
		Map<String, String> halfWritten = new HashMap<>(emails());
		halfWritten.put("notSelectedMessage", "");
		put(operator, draft, halfWritten).expectStatus().isOk();
		String kept = body(get(operator, release).expectStatus().isOk());
		assertThat(JsonPath.<String>read(kept, "$.emails.shortlistedSubject")).isEqualTo("Shortlisted: Released challenge");
		assertThat(JsonPath.<String>read(kept, "$.emails.notSelectedMessage")).isEmpty();
		assertThat(mail.latestSubjectTo("chosen@drafted.test")).isNotEqualTo("Shortlisted: Released challenge");

		// A later save replaces the earlier one; a subject longer than an email's is refused.
		put(operator, draft, emails()).expectStatus().isOk();
		Map<String, String> tooLong = new HashMap<>(emails());
		tooLong.put("shortlistedSubject", "s".repeat(201));
		put(operator, draft, tooLong).expectStatus().isBadRequest();
		assertThat(JsonPath.<String>read(body(get(operator, release).expectStatus().isOk()), "$.emails.notSelectedMessage"))
			.isEqualTo("Hi {organization},\n\nNot this time.");

		// Once released, the emails are the ones sent and can no longer be written.
		post(operator, REVIEW + form.programId() + "/decisions", decision(List.of(chosen.id()), "shortlisted"))
			.expectStatus()
			.isOk();
		close(form);
		Map<String, String> sent = new HashMap<>(emails());
		sent.put("shortlistedSubject", "Sent: Drafted challenge");
		post(operator, release, sent).expectStatus().isOk();
		assertProblem(put(operator, draft, emails()), 409, "PROPOSAL_RELEASED");
		assertThat(JsonPath.<String>read(body(get(operator, release).expectStatus().isOk()), "$.emails.shortlistedSubject"))
			.isEqualTo("Sent: Drafted challenge");
	}

	@Test
	void aProgramNobodyAppliedToHasNoOutcomesToRelease() {
		Form form = program("empty-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		close(form);

		String release = REVIEW + form.programId() + "/release";
		assertThat(JsonPath.<Boolean>read(body(get(operator, release).expectStatus().isOk()), "$.ready")).isFalse();
		assertProblem(post(operator, release, emails()), 409, "PROPOSAL_OUTCOMES_NOT_READY");
	}

	@Test
	void nobodyScoresOrDecidesAnApplicationOfTheirOwn() {
		Form form = program("own-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		List<String> criteria = criteriaOf(form, "Practical impact");
		Applicant applicant = applicant(form, "builder@own.test", "Own Builder");
		Applicant other = applicant(form, "other@own.test", "Other Builder");
		// The same person is invited to judge the program they applied to.
		post(operator, REVIEW + form.programId() + "/reviewers", Map.of("email", applicant.email())).expectStatus().isOk();
		shortlist(form, applicant.id(), other.id());

		String list = body(get(applicant.session(), REVIEW + form.programId() + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<Boolean>>read(list, "$.items[*].own")).containsExactly(true, false);
		String own = API + "/review/applications/" + applicant.id();
		assertThat(JsonPath.<Boolean>read(body(get(applicant.session(), own).expectStatus().isOk()), "$.own")).isTrue();
		assertProblem(put(applicant.session(), own + "/assessment", scores(Map.of(criteria.get(0), 5))), 403,
				"PROPOSAL_OWN_APPLICATION");
		assertProblem(put(applicant.session(), own + "/assessment", Map.of("scores", Map.of(), "conflict", true, "bookmarked", false)), 403,
				"PROPOSAL_OWN_APPLICATION");
		put(applicant.session(), API + "/review/applications/" + other.id() + "/assessment",
				scores(Map.of(criteria.get(0), 4)))
			.expectStatus()
			.isOk();

		// An operator who applied through an organization does not decide on its application.
		String operatorSession = operator;
		post(operatorSession, form.path() + "/organization", Map.of("kind", "individual", "name", "Operator Builder",
				"country", "VN"))
			.expectStatus()
			.isOk();
		String operatorApplication = submittedBy(operatorSession, "operator@proposal.test", form);
		assertProblem(post(operator, REVIEW + form.programId() + "/decisions",
				decision(List.of(UUID.fromString(operatorApplication)), "shortlisted")), 403, "PROPOSAL_OWN_APPLICATION");
	}

	@Test
	void aWithdrawalUndoesTheDecisionSoTheNextSubmissionIsDecidedAfresh() {
		Form form = program("withdrawn-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		criteriaOf(form, "Practical impact");
		Applicant applicant = applicant(form, "back@withdrawn.test", "Back Builder");
		String one = API + "/review/applications/" + applicant.id();
		post(operator, REVIEW + form.programId() + "/decisions", decision(List.of(applicant.id()), "shortlisted"))
			.expectStatus()
			.isOk();

		post(applicant.session(), API + "/applications/" + applicant.id() + "/withdraw", null).expectStatus().isOk();
		resubmit(form, applicant);
		String again = body(get(operator, one).expectStatus().isOk());
		assertThat(JsonPath.<String>read(again, "$.reviewStatus")).isEqualTo("under_review");
		assertThat(JsonPath.<List<String>>read(again, "$.history[*].decision")).containsSubsequence("shortlisted",
				"under_review");
		assertThat(JsonPath.<List<String>>read(again, "$.history[*].reason"))
			.contains("The applicant withdrew the application.");

		// Submitting changes without withdrawing keeps the decision: the scores say which version they were made on.
		post(operator, REVIEW + form.programId() + "/decisions", decision(List.of(applicant.id()), "not_selected"))
			.expectStatus()
			.isOk();
		resubmit(form, applicant);
		assertThat(JsonPath.<String>read(body(get(operator, one).expectStatus().isOk()), "$.reviewStatus"))
			.isEqualTo("not_selected");
	}

	@Test
	void anOperatorsAppListsAProgramsApplicationsReadsOneInFullAndSeesThePagesOfItsDeck(
			@Value("${beyondpilot.storage.local.directory}") String storage) throws IOException {
		Form form = program("listed-by-mcp", true, Instant.now().plus(Duration.ofDays(10)));
		List<String> criteria = criteriaOf(form, "Practical impact");
		Applicant first = applicant(form, "first@mcp-apply.test", "First Builder");
		applicant(form, "second@mcp-apply.test", "Second Builder");

		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = McpClient
			.sync(HttpClientStreamableHttpTransport.builder("http://localhost:" + port)
				.endpoint("/mcp/operator")
				.httpRequestCustomizer((builder, method, uri, body, context) -> builder.header("Authorization",
						"Bearer " + token))
				.build())
			.requestTimeout(Duration.ofSeconds(20))
			.build();
		app.initialize();
		assertThat(app.listTools().tools()).extracting(McpSchema.Tool::name)
			.startsWith("search", "fetch", "list_applications", "get_application", "read_application_file",
					"list_pending_reviews");

		CallToolResult result = app.callTool(McpSchema.CallToolRequest.builder("list_applications")
			.arguments(Map.of("program", "program:listed-by-mcp"))
			.build());
		assertThat(result.isError()).isFalse();
		String listed = ((TextContent) result.content().getFirst()).text();
		assertThat(JsonPath.<Integer>read(listed, "$.submitted")).isEqualTo(2);
		assertThat(JsonPath.<List<String>>read(listed, "$.applications[*].solution"))
			.containsExactly("First Builder Desk", "Second Builder Desk");
		assertThat(JsonPath.<List<String>>read(listed, "$.applications[*].decision")).containsOnly("under_review");
		assertThat(JsonPath.<String>read(listed, "$.applications[0].url"))
			.contains("/admin/programs/" + form.programId() + "/applications/");

		CallToolResult unknown = app.callTool(McpSchema.CallToolRequest.builder("list_applications")
			.arguments(Map.of("program", "program:no-such-program"))
			.build());
		assertThat(unknown.isError()).isTrue();

		// One application in full: what the applicant sent, the scores by criterion and the files it holds.
		put(operator, API + "/review/applications/" + first.id() + "/assessment",
				scores(Map.of(criteria.get(0), 4)))
			.expectStatus()
			.isOk();
		CallToolResult read = app.callTool(McpSchema.CallToolRequest.builder("get_application")
			.arguments(Map.of("application", first.id().toString()))
			.build());
		assertThat(read.isError()).isFalse();
		String application = ((TextContent) read.content().getFirst()).text();
		assertThat(JsonPath.<String>read(application, "$.solution.name")).isEqualTo("First Builder Desk");
		assertThat(JsonPath.<String>read(application, "$.applicant.email")).isEqualTo("first@mcp-apply.test");
		assertThat(JsonPath.<Integer>read(application, "$.assessments[0].scores['Practical impact']")).isEqualTo(4);
		assertThat(JsonPath.<List<String>>read(application, "$.files[*].holds")).contains("deck");
		String deck = JsonPath.<List<String>>read(application, "$.files[?(@.holds == 'deck')].id").getFirst();

		// Its deck, page by page: the text the file holds and the picture of each page.
		Path stored = Path.of(storage).toAbsolutePath().resolve("test").resolve(deck);
		Files.createDirectories(stored.getParent());
		Files.write(stored, TestPdf.of("Claims triage in minutes.", ""));
		CallToolResult pages = app.callTool(McpSchema.CallToolRequest.builder("read_application_file")
			.arguments(Map.of("application", first.id().toString(), "file", deck))
			.build());
		assertThat(pages.isError()).isFalse();
		String head = ((TextContent) pages.content().getFirst()).text();
		assertThat(JsonPath.<Integer>read(head, "$.pages")).isEqualTo(2);
		assertThat(JsonPath.<String>read(head, "$.shown")).isEqualTo("1-2");
		assertThat(pages.content()).hasSize(5);
		assertThat(((TextContent) pages.content().get(1)).text()).isEqualTo("Page 1:\nClaims triage in minutes.");
		assertThat(((ImageContent) pages.content().get(2)).mimeType()).isEqualTo("image/jpeg");
		assertThat(((TextContent) pages.content().get(3)).text()).contains("no text");

		// A file the application does not hold, a page past its end and a page that is not a number are refused.
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("read_application_file")
			.arguments(Map.of("application", first.id().toString(), "file", UUID.randomUUID().toString()))
			.build()).isError()).isTrue();
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("read_application_file")
			.arguments(Map.of("application", first.id().toString(), "file", deck, "page", 3))
			.build()).isError()).isTrue();
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("read_application_file")
			.arguments(Map.of("application", first.id().toString(), "file", deck, "page", "2"))
			.build()).isError()).isTrue();
		app.closeGracefully();
	}

	@Test
	void anOperatorsAppNarrowsTheApplicationsReadsADraftAndAProgramsReviewWithoutReleasingIt() {
		Form form = program("reviewed-by-mcp", true, Instant.now().plus(Duration.ofDays(10)));
		criteriaOf(form, "Practical impact");
		judge(form, "judge@program-mcp.test");
		Applicant chosen = applicant(form, "chosen@program-mcp.test", "Chosen Builder");
		applicant(form, "waiting@program-mcp.test", "Waiting Builder");
		shortlist(form, chosen.id());
		String later = TestSignIn.session(client, mail, "later@program-mcp.test");
		Map<String, String> answered = new HashMap<>();
		answered.put(form.approach().toString(), "Claims reach a decision without a hotline call.");
		put(later, form.path(), application(contact("Later Builder"), null, answered, null)).expectStatus().isOk();
		McpSyncClient app = operatorApp();

		// Narrowed by decision and by challenge area, whose options the answer gives; the drafts when asked.
		String shortlisted = call(app, "list_applications",
				Map.of("program", "program:reviewed-by-mcp", "status", "shortlisted", "drafts", true));
		assertThat(JsonPath.<Integer>read(shortlisted, "$.submitted")).isEqualTo(2);
		assertThat(JsonPath.<List<String>>read(shortlisted, "$.applications[*].email"))
			.containsExactly("chosen@program-mcp.test");
		assertThat(JsonPath.<List<String>>read(shortlisted, "$.challengeArea.options")).containsExactly("Buying",
				"Carrying", "Claiming");
		assertThat(JsonPath.<List<String>>read(shortlisted, "$.draftApplications[*].email"))
			.containsExactly("later@program-mcp.test");
		assertThat(JsonPath.<Integer>read(shortlisted, "$.draftApplications[0].requiredAnswered")).isEqualTo(1);
		assertThat(JsonPath.<List<String>>read(call(app, "list_applications",
				Map.of("program", "reviewed-by-mcp", "challenge_area", "claiming")), "$.applications[*].challengeArea"))
			.containsExactly("Claiming", "Claiming");
		assertThat(JsonPath.<List<Object>>read(call(app, "list_applications",
				Map.of("program", "reviewed-by-mcp", "challenge_area", "Buying")), "$.applications")).isEmpty();
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("list_applications")
			.arguments(Map.of("program", "reviewed-by-mcp", "challenge_area", "Sailing"))
			.build()).isError()).isTrue();

		// An application's decisions, with who decided and why; the answers only in detail; a draft as it stands.
		String application = call(app, "get_application", Map.of("application", chosen.id().toString()));
		assertThat(JsonPath.<String>read(application, "$.state")).isEqualTo("submitted");
		assertThat(application).doesNotContain("\"answers\"");
		assertThat(JsonPath.<List<String>>read(call(app, "get_application",
				Map.of("application", chosen.id().toString(), "detail", true)), "$.answers[*].value"))
			.contains("Claiming");
		assertThat(JsonPath.<List<String>>read(application, "$.history[*].kind")).containsExactly("submitted",
				"decided");
		assertThat(JsonPath.<String>read(application, "$.history[1].decision")).isEqualTo("shortlisted");
		assertThat(JsonPath.<String>read(application, "$.history[1].reason")).isEqualTo("The strongest in Claiming.");
		String draftId = JsonPath.read(shortlisted, "$.draftApplications[0].id");
		String draft = call(app, "get_application", Map.of("application", draftId, "detail", true));
		assertThat(JsonPath.<String>read(draft, "$.state")).isEqualTo("draft");
		assertThat(JsonPath.<String>read(draft, "$.applicant.email")).isEqualTo("later@program-mcp.test");
		assertThat(JsonPath.<List<String>>read(draft, "$.answers[*].value"))
			.containsExactly("Claims reach a decision without a hotline call.");
		assertThat(JsonPath.<String>read(draft, "$.url"))
			.endsWith("/admin/programs/" + form.programId() + "/applications/drafts/" + draftId);

		// Every program with its counts; one program with its form and its review, which releases nothing.
		String programs = call(app, "list_programs", Map.of());
		String counts = "$.programs[?(@.programId == '" + form.programId() + "')].applicationCounts.";
		assertThat(JsonPath.<List<Integer>>read(programs, counts + "submitted")).containsExactly(2);
		assertThat(JsonPath.<List<Integer>>read(programs, counts + "drafts")).containsExactly(1);
		String program = call(app, "get_program", Map.of("program", form.programId().toString()));
		assertThat(JsonPath.<String>read(program, "$.id")).isEqualTo("program:reviewed-by-mcp");
		assertThat(JsonPath.<String>read(program, "$.applications.closesAt")).isNotBlank();
		assertThat(JsonPath.<List<String>>read(program, "$.questions[*].label")).contains("Direction");
		assertThat(JsonPath.<List<List<String>>>read(call(app, "get_program",
				Map.of("program", "program:reviewed-by-mcp", "detail", true)),
				"$.questions[?(@.label == 'Direction')].options")).containsExactly(List.of("Buying", "Carrying",
						"Claiming"));
		assertThat(JsonPath.<List<String>>read(program, "$.review.criteria[*].name"))
			.containsExactly("Practical impact");
		assertThat(JsonPath.<List<String>>read(program, "$.review.judges[*].email"))
			.containsExactly("judge@program-mcp.test");
		assertThat(JsonPath.<Boolean>read(program, "$.review.outcomes.released")).isFalse();
		assertThat(JsonPath.<List<String>>read(program, "$.review.outcomes.shortlisted[*].id"))
			.containsExactly(chosen.id().toString());
		assertThat(JsonPath.<List<String>>read(program, "$.review.outcomes.undecided[*].organization"))
			.containsExactly("Waiting Builder");
		assertThat(jdbc.sql("select count(*) from proposal_release where program_id = ?")
			.params(form.programId())
			.query(Long.class)
			.single()).isZero();
		assertThat(auditOf(form.programId())).doesNotContain("proposal.release");

		// The activity names what each call read and links its admin page.
		assertThat(jdbc.sql("""
				select tool || ' ' || target_kind || ' ' || target_label || ' ' || target_path from mcp_call
				where tool in ('get_program', 'get_application') and target_id in (?, ?) order by called_at
				""").params(form.programId().toString(), draftId).query(String.class).list()).containsExactly(
				"get_application draft Later Builder · Reviewed by mcp /admin/programs/" + form.programId()
						+ "/applications/drafts/" + draftId,
				"get_program program Reviewed by mcp /admin/programs/" + form.programId(),
				"get_program program Reviewed by mcp /admin/programs/" + form.programId());
		app.closeGracefully();
	}

	/** An app connected to the operators' server by the operator, initialized. */
	private McpSyncClient operatorApp() {
		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = McpClient
			.sync(HttpClientStreamableHttpTransport.builder("http://localhost:" + port)
				.endpoint("/mcp/operator")
				.httpRequestCustomizer((builder, method, uri, body, context) -> builder.header("Authorization",
						"Bearer " + token))
				.build())
			.requestTimeout(Duration.ofSeconds(20))
			.build();
		app.initialize();
		return app;
	}

	/** The JSON text a tool answered, which must not be an error. */
	private static String call(McpSyncClient app, String tool, Map<String, Object> arguments) {
		CallToolResult result = app.callTool(McpSchema.CallToolRequest.builder(tool).arguments(arguments).build());
		String text = ((TextContent) result.content().getFirst()).text();
		assertThat(result.isError()).as(text).isFalse();
		return text;
	}

	/** Submits an application of the caller, who already belongs to an organization, and answers its identifier. */
	private String submittedBy(String session, String email, Form form) {
		UUID solution = completeSolution(session, email, "Operator Desk");
		submitted(session, email, form, solution);
		return JsonPath.read(body(get(session, API + "/applications").expectStatus().isOk()), "$.items[0].id");
	}

	/** Sets a program's criteria and answers their identifiers in order. */
	private List<String> criteriaOf(Form form, String... names) {
		return JsonPath.read(body(put(operator, REVIEW + form.programId() + "/criteria", criteria(names))
			.expectStatus()
			.isOk()), "$.criteria[*].id");
	}

	/** GenAI Fund shortlists the applications, which judges then read. */
	private void shortlist(Form form, UUID... ids) {
		post(operator, REVIEW + form.programId() + "/decisions", decision(List.of(ids), "shortlisted"))
			.expectStatus()
			.isOk();
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
		// On their own, a person is shown by the name their application gives.
		submitted(session, email, form, solution, contact(name));
		String id = JsonPath.read(body(get(session, API + "/applications").expectStatus().isOk()), "$.items[0].id");
		return new Applicant(session, email, solution, UUID.fromString(id), name);
	}

	private void resubmit(Form form, Applicant applicant) {
		String view = body(get(applicant.session(), form.path()).expectStatus().isOk());
		Map<String, Object> change = application(contact(applicant.name()), applicant.solution(), answers(form, applicant.email()),
				versionOf(view));
		change.put("deckFileId", JsonPath.read(view, "$.application.deck.fileId"));
		put(applicant.session(), form.path(), change).expectStatus().isOk();
		post(applicant.session(), API + "/applications/" + applicant.id() + "/submit", null).expectStatus().isOk();
	}

	private static Map<String, Object> scores(Map<String, Integer> scores) {
		return Map.of("scores", scores, "note", "Clear on consent.", "conflict", false, "bookmarked", false);
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

	private record Applicant(String session, String email, UUID solution, UUID id, String name) {
	}

	private static Map<String, Object> criteria(String... names) {
		return Map.of("criteria", List.of(names).stream().map(name -> Map.of("name", name)).toList());
	}
}
