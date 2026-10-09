package ai.genaifund.beyondpilot.solution;

import static java.nio.charset.StandardCharsets.US_ASCII;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.HashMap;
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
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Solutions over real HTTP against PostgreSQL: who writes them, what a submission needs, what operators decide and what
 * the public directory shows. Only the SMTP server is replaced. Each test uses its own email domain, because a domain
 * belongs to one organization, and its own word in the names it searches for, because the tests share one database.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, SolutionTest.Mail.class })
class SolutionTest {

	private static final String ORGANIZATION = "/api/organization";

	private static final String MINE = "/api/solution/mine";

	private static final String ADMIN = "/api/solution/admin/solutions";

	private static final String DIRECTORY = "/api/solution/solutions";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = signIn("operator@genaifund.test");
	}

	@Test
	void everyMemberWritesWhetherOrNotGenAiFundHasReviewedTheOrganization() {
		String founder = signIn("founder@writers.test");
		UUID organization = organization(founder, "Writers Co");

		// Review decides what is listed, not who takes part: an organization that waits for review writes already.
		UUID solution = create(founder, "Writers Desk");
		submitted(founder, "Writers Draft");
		String forFounder = body(get(founder, MINE).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(forFounder, "$.editable")).isTrue();

		approve(organization);
		String colleague = signIn("colleague@writers.test");
		post(founder, ORGANIZATION + "/mine/invitations", Map.of("email", "colleague@writers.test", "role", "member"))
			.expectStatus()
			.isNoContent();
		String invitation = JsonPath.read(body(get(colleague, ORGANIZATION + "/mine").expectStatus().isOk()),
				"$.invitations[0].id");
		post(colleague, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
		String forMember = body(get(colleague, MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(forMember, "$.items[*].name")).contains("Writers Desk");
		assertThat(JsonPath.<Boolean>read(forMember, "$.editable")).isTrue();
		String bySaved = body(put(colleague, MINE + "/" + solution, described("Writers Desk", 0)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(bySaved, "$.summary")).isNotBlank();
		create(colleague, "By A Member");

		String buyer = signIn("buyer@other-company.test");
		approve(organization(buyer, "Other Company"));
		// Another organization does not see it at all.
		assertProblem(get(buyer, MINE + "/" + solution), 404, "SOLUTION_NOT_FOUND");

		String nobody = body(get(signIn("nobody@elsewhere.test"), MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<Object>>read(nobody, "$.items")).isEmpty();
		assertThat(JsonPath.<Boolean>read(nobody, "$.editable")).isFalse();
		assertProblem(post(signIn("nobody@elsewhere.test"), MINE, Map.of("name", "By Nobody")), 403,
				"SOLUTION_MEMBER_REQUIRED");
	}

	@Test
	void aSolutionIsListedOnlyOnceItsOrganizationIsApprovedToo() {
		String founder = signIn("founder@unreviewed.test");
		UUID organization = organization(founder, "Unreviewed Co");
		UUID solution = submitted(founder, "Unreviewed Desk");

		assertProblem(post(operator, ADMIN + "/" + solution + "/approve", null), 409,
				"SOLUTION_ORGANIZATION_NOT_APPROVED");
		approve(organization);
		post(operator, ADMIN + "/" + solution + "/approve", null).expectStatus().isNoContent();
		assertThat(names(DIRECTORY)).contains("Unreviewed Desk");
	}

	@Test
	void aDraftNeedsOnlyANameAndASubmissionNeedsMore() {
		String founder = approvedOwner("founder@drafts.test", "Drafts Co");

		String draft = body(post(founder, MINE, Map.of("name", "  Draft Desk  ")).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		assertThat(JsonPath.<String>read(draft, "$.name")).isEqualTo("Draft Desk");
		assertThat(JsonPath.<String>read(draft, "$.slug")).isEqualTo("draft-desk");
		assertThat(JsonPath.<String>read(draft, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<Boolean>read(draft, "$.complete")).isFalse();
		assertProblem(post(founder, MINE, Map.of("name", " ")), 400, "REQUEST_INVALID");
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 400, "SOLUTION_INCOMPLETE");

		// Its facts alone are not enough: a review asks for a logo and a cover too.
		Map<String, Object> request = described("Draft Desk", versionOf(draft));
		String saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(saved, "$.complete")).isFalse();
		assertThat(JsonPath.<List<String>>read(body(get(founder, MINE).expectStatus().isOk()), "$.items[0].missing"))
			.containsExactly("logo", "cover");
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 400, "SOLUTION_INCOMPLETE");
		request = pictured(founder, request);
		request.put("version", versionOf(saved));
		saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(saved, "$.complete")).isTrue();
		assertThat(JsonPath.<List<String>>read(body(get(founder, MINE).expectStatus().isOk()), "$.items[0].missing"))
			.isEmpty();
		String submitted = body(post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk());

		assertThat(JsonPath.<String>read(submitted, "$.status")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(submitted, "$.submittedAt")).isNotNull();
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 409, "SOLUTION_NOT_SUBMITTABLE");
		// What operators review keeps what a submission needs: its facts, and its logo and cover.
		request.put("version", versionOf(submitted));
		Map<String, Object> emptied = new HashMap<>(request);
		emptied.put("summary", null);
		assertProblem(put(founder, MINE + "/" + id, emptied), 400, "SOLUTION_INCOMPLETE");
		Map<String, Object> bare = new HashMap<>(request);
		bare.put("coverFileId", null);
		assertProblem(put(founder, MINE + "/" + id, bare), 400, "SOLUTION_INCOMPLETE");
		assertThat(stored(UUID.fromString(request.get("coverFileId").toString()))).isTrue();

		// A solution reviewed before a logo and a cover were asked for stays as it is: a save does not ask for them,
		// and still takes nothing else away.
		jdbc.sql("update solution set logo_file_id = null, cover_file_id = null where id = ?").param(id).update();
		Map<String, Object> earlier = described("Draft Desk", versionOf(submitted));
		earlier.put("listed", false);
		String kept = body(put(founder, MINE + "/" + id, earlier).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(kept, "$.complete")).isFalse();
		earlier.put("version", versionOf(kept));
		earlier.put("summary", null);
		assertProblem(put(founder, MINE + "/" + id, earlier), 400, "SOLUTION_INCOMPLETE");
	}

	@Test
	void aSaveOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		String founder = approvedOwner("founder@bounds.test", "Bounds Co");
		String draft = body(post(founder, MINE, Map.of("name", "Bounds Desk")).expectStatus().isCreated());
		Map<String, Object> request = described("Bounds Desk", versionOf(draft));
		request.put("industries", List.of("gardening"));
		request.put("maturity", "finished");
		request.put("website", "example.test");
		request.put("demoUrl", "javascript:alert(1)");
		request.put("languages", List.of("klingon"));
		request.put("builtWith", List.of("Python", " "));
		request.put("summary", "x".repeat(601));

		String body = body(put(founder, MINE + "/" + JsonPath.<String>read(draft, "$.id"), request).expectStatus()
			.isBadRequest());

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/industries/0",
				"#/maturity", "#/website", "#/demoUrl", "#/languages/0", "#/builtWith/1", "#/summary");
	}

	@Test
	void aSaveFromAStaleScreenIsRefused() {
		String founder = approvedOwner("founder@stale.test", "Stale Co");
		String draft = body(post(founder, MINE, Map.of("name", "Stale Desk")).expectStatus().isCreated());
		String path = MINE + "/" + JsonPath.<String>read(draft, "$.id");

		String saved = body(put(founder, path, described("Stale Desk", versionOf(draft))).expectStatus().isOk());

		assertThat(versionOf(saved)).isGreaterThan(versionOf(draft));
		assertProblem(put(founder, path, described("Overwritten", versionOf(draft))), 409, "SOLUTION_CHANGED_MEANWHILE");
		assertThat(JsonPath.<String>read(body(get(founder, path).expectStatus().isOk()), "$.name"))
			.isEqualTo("Stale Desk");
	}

	@Test
	void onlyADraftIsDeleted() {
		String founder = approvedOwner("founder@deleted.test", "Deleted Co");
		UUID draft = create(founder, "Deleted Desk");
		UUID sent = submitted(founder, "Kept Desk");

		delete(founder, MINE + "/" + draft).expectStatus().isNoContent();

		assertProblem(get(founder, MINE + "/" + draft), 404, "SOLUTION_NOT_FOUND");
		assertProblem(delete(founder, MINE + "/" + sent), 409, "SOLUTION_NOT_A_DRAFT");
		get(founder, MINE + "/" + sent).expectStatus().isOk();
	}

	@Test
	void anOperatorSendsBackWithWhatToChangeAndApprovesWhatIsSentAgain() {
		String founder = approvedOwner("founder@reviewed.test", "Reviewed Co");
		UUID draft = create(founder, "Unsent Desk");
		UUID id = submitted(founder, "Reviewed Desk");

		assertProblem(post(founder, ADMIN + "/" + id + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(founder, ADMIN + "/" + id + "/send-back", Map.of("reason", "Say who it is for.")), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		// Operators see what was sent to them, never a draft.
		assertProblem(get(operator, ADMIN + "/" + draft), 404, "SOLUTION_NOT_FOUND");
		assertProblem(post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", " ")), 400, "REQUEST_INVALID");
		assertProblem(post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "x".repeat(1001))), 400,
				"REQUEST_INVALID");
		post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "Say who it is for."))
			.expectStatus()
			.isNoContent();

		String sentBack = body(get(founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(sentBack, "$.status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(sentBack, "$.decisionReason")).isNull();
		assertThat(JsonPath.<String>read(sentBack, "$.decisionMessage")).isEqualTo("Say who it is for.");
		assertThat(mail.latestSubjectTo("founder@reviewed.test")).isEqualTo("Changes needed: Reviewed Desk");
		assertThat(mail.latestTextTo("founder@reviewed.test")).contains("Say who it is for.");
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "SOLUTION_NOT_AWAITING_REVIEW");
		assertProblem(post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "Again.")), 409,
				"SOLUTION_NOT_AWAITING_REVIEW");

		String sentAgain = body(post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk());
		// Sending it again answers the send back, so the record waits with no decision on it.
		assertThat(JsonPath.<String>read(sentAgain, "$.status")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(sentAgain, "$.decisionMessage")).isNull();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();

		String approved = body(get(operator, ADMIN + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(approved, "$.organizationName")).isEqualTo("Reviewed Co");
		assertThat(mail.latestSubjectTo("founder@reviewed.test")).isEqualTo("Reviewed Desk is approved on BeyondPilot");
		assertThat(events(id)).containsExactly("solution.send_back", "solution.approve");
		// A decision is made once.
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "SOLUTION_NOT_AWAITING_REVIEW");
	}

	@Test
	void aRejectionIsFinalAndOnlyForASolutionInReview() {
		String founder = approvedOwner("founder@refused.test", "Refused Co");
		UUID id = submitted(founder, "Refused Desk");

		assertProblem(post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "boring")), 400, "REQUEST_INVALID");
		// Missing information is a send back, not a reason to refuse.
		assertProblem(post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "incomplete")), 400,
				"REQUEST_INVALID");
		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "duplicate", "message", "Listed twice."))
			.expectStatus()
			.isNoContent();

		String rejected = body(get(founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(rejected, "$.status")).isEqualTo("rejected");
		assertThat(JsonPath.<String>read(rejected, "$.decisionReason")).isEqualTo("duplicate");
		assertThat(JsonPath.<String>read(rejected, "$.decisionMessage")).isEqualTo("Listed twice.");
		assertThat(mail.latestSubjectTo("founder@refused.test")).isEqualTo("Refused Desk on BeyondPilot");
		// Its owners cannot send it again, and an operator decides it only once.
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 409, "SOLUTION_NOT_SUBMITTABLE");
		assertProblem(post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "duplicate")), 409,
				"SOLUTION_NOT_AWAITING_REVIEW");
		// What was refused stays as it was reviewed.
		assertProblem(put(founder, MINE + "/" + id, described("Rewritten Desk", versionOf(rejected))), 409,
				"SOLUTION_NOT_EDITABLE");

		// An approved solution is taken down, never refused.
		UUID approved = approved(founder, "Approved Desk");
		assertProblem(post(operator, ADMIN + "/" + approved + "/reject", Map.of("reason", "duplicate")), 409,
				"SOLUTION_NOT_AWAITING_REVIEW");
	}

	@Test
	void theOperatorsListFindsASolutionByItsOrganizationNarrowsByIndustryAndNamesWhoSentIt() {
		String founder = approvedOwner("founder@harbour.test", "Harbour Analytics");
		long waiting = JsonPath
			.<Number>read(body(get(operator, ADMIN).expectStatus().isOk()), "$.awaitingReview")
			.longValue();
		Map<String, Object> forLogistics = described("Quay Desk", 0);
		forLogistics.put("industries", List.of("logistics"));
		UUID id = submitted(founder, "Quay Desk", forLogistics);

		// The name of the solution does not hold the text; the name of its organization does.
		String byOrganization = body(get(operator, ADMIN + "?q=HARBOUR").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(byOrganization, "$.items[*].name")).containsExactly("Quay Desk");
		assertThat(JsonPath.<String>read(byOrganization, "$.items[0].organizationName")).isEqualTo("Harbour Analytics");
		assertThat(JsonPath.<String>read(byOrganization, "$.items[0].submittedBy")).isEqualTo("founder@harbour.test");
		assertThat(JsonPath.<Number>read(byOrganization, "$.awaitingReview").longValue()).isEqualTo(waiting + 1);

		assertThat(names(operator, ADMIN + "?q=quay&industry=logistics")).containsExactly("Quay Desk");
		assertThat(names(operator, ADMIN + "?q=quay&industry=insurance")).isEmpty();
		assertProblem(get(operator, ADMIN + "?industry=astrology"), 400, "REQUEST_INVALID");

		String record = body(get(operator, ADMIN + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(record, "$.submittedBy")).isEqualTo("founder@harbour.test");
		// A decision takes it out of what waits, whatever the list is narrowed to.
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		assertThat(JsonPath
			.<Number>read(body(get(operator, ADMIN + "?status=rejected").expectStatus().isOk()), "$.awaitingReview")
			.longValue()).isEqualTo(waiting);
	}

	@Test
	void theOperatorsListIsReadAPageAtATimeTheLongestWaitFirst() {
		String founder = approvedOwner("founder@pager.test", "Pager Works");
		for (int number = 1; number <= 26; number++) {
			submitted(founder, "Pager Desk %02d".formatted(number));
		}

		String first = body(get(operator, ADMIN + "?q=pager desk").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(first, "$.total")).isEqualTo(26);
		assertThat(JsonPath.<Integer>read(first, "$.pageSize")).isEqualTo(25);
		assertThat(JsonPath.<List<String>>read(first, "$.items[*].name")).hasSize(25).startsWith("Pager Desk 01");

		String second = body(get(operator, ADMIN + "?q=pager desk&page=2").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(second, "$.page")).isEqualTo(2);
		assertThat(JsonPath.<List<String>>read(second, "$.items[*].name")).containsExactly("Pager Desk 26");
		// A page past the last one is empty, not an error; a page before the first is refused.
		assertThat(names(operator, ADMIN + "?q=pager desk&page=3")).isEmpty();
		assertProblem(get(operator, ADMIN + "?page=0"), 400, "REQUEST_INVALID");
	}

	@Test
	void aSolutionSentBeforeTheSenderWasRecordedNamesNobody() {
		String founder = approvedOwner("founder@earlier.test", "Earlier Co");
		UUID id = submitted(founder, "Earlier Desk");
		// What a solution submitted before the column existed looks like.
		jdbc.sql("update solution set submitted_by_account_id = null where id = ?").param(id).update();

		String listed = body(get(operator, ADMIN + "?q=earlier desk").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(listed, "$.items[*].name")).containsExactly("Earlier Desk");
		assertThat(JsonPath.<String>read(listed, "$.items[0].submittedBy")).isNull();
		assertThat(JsonPath.<String>read(body(get(operator, ADMIN + "/" + id).expectStatus().isOk()), "$.submittedBy"))
			.isNull();
		// The owners read it the same way, and sending it again records who did.
		post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "Add a cover.")).expectStatus().isNoContent();
		String sentAgain = body(post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(sentAgain, "$.submittedBy")).isEqualTo("founder@earlier.test");
	}

	@Test
	void anOperatorTakesAnApprovedSolutionDownAndRestoresItWithoutANewReview() {
		String founder = approvedOwner("founder@removed.test", "Removed Co");
		UUID id = approved(founder, "Removed Desk");
		UUID waiting = submitted(founder, "Waiting Desk");
		client.get().uri(DIRECTORY + "/removed-desk").exchange().expectStatus().isOk();

		assertProblem(post(founder, ADMIN + "/" + id + "/take-down", Map.of("reason", "unverifiable")), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "incomplete")), 400,
				"REQUEST_INVALID");
		assertProblem(post(operator, ADMIN + "/" + waiting + "/take-down", Map.of("reason", "unverifiable")), 409,
				"SOLUTION_NOT_APPROVED");
		assertProblem(post(operator, ADMIN + "/" + id + "/restore", null), 409, "SOLUTION_NOT_TAKEN_DOWN");
		post(operator, ADMIN + "/" + id + "/take-down",
				Map.of("reason", "misleading_information", "message", "The customers named are not real."))
			.expectStatus()
			.isNoContent();

		assertProblem(client.get().uri(DIRECTORY + "/removed-desk").exchange(), 404, "SOLUTION_NOT_FOUND");
		assertThat(names(DIRECTORY + "?q=removed desk")).isEmpty();
		String down = body(get(founder, MINE + "/" + id).expectStatus().isOk());
		// Its review stays approved; the takedown says why.
		assertThat(JsonPath.<String>read(down, "$.status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(down, "$.suspendedAt")).isNotNull();
		assertThat(JsonPath.<String>read(down, "$.suspensionReason")).isEqualTo("misleading_information");
		assertThat(JsonPath.<String>read(down, "$.suspensionMessage")).isEqualTo("The customers named are not real.");
		assertThat(mail.latestSubjectTo("founder@removed.test")).isEqualTo("Removed Desk on BeyondPilot");
		assertProblem(post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "unverifiable")), 409,
				"SOLUTION_NOT_APPROVED");
		// Its owners cannot send it for review while it is down; an operator restores it.
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 409, "SOLUTION_NOT_SUBMITTABLE");

		assertThat(names(operator, ADMIN + "?q=removed desk&status=suspended")).containsExactly("Removed Desk");
		assertThat(names(operator, ADMIN + "?q=removed desk&status=approved")).isEmpty();
		assertThat(JsonPath.<String>read(body(get(operator, ADMIN + "?q=removed desk").expectStatus().isOk()),
				"$.items[0].suspendedAt")).isNotNull();

		// Back in the directory means its organization is shown too: not while the organization is down.
		jdbc.sql("update organization set suspended_at = now() where id = (select organization_id from solution where id = ?)")
			.param(id)
			.update();
		assertProblem(post(operator, ADMIN + "/" + id + "/restore", null), 409, "SOLUTION_ORGANIZATION_NOT_APPROVED");
		jdbc.sql("update organization set suspended_at = null where id = (select organization_id from solution where id = ?)")
			.param(id)
			.update();

		post(operator, ADMIN + "/" + id + "/restore", null).expectStatus().isNoContent();
		client.get().uri(DIRECTORY + "/removed-desk").exchange().expectStatus().isOk();
		assertThat(JsonPath.<String>read(body(get(founder, MINE + "/" + id).expectStatus().isOk()), "$.suspendedAt"))
			.isNull();
		assertThat(names(operator, ADMIN + "?q=removed desk&status=approved")).containsExactly("Removed Desk");
		assertThat(mail.latestSubjectTo("founder@removed.test")).isEqualTo("Removed Desk is back on BeyondPilot");
		assertThat(events(id)).containsExactly("solution.approve", "solution.take_down", "solution.restore");
	}

	@Test
	void aSolutionWithoutItsOwnLogoShowsItsOrganizationsToThePublic() {
		String founder = approvedOwner("founder@logo.test", "Logo Co");
		approved(founder, "Wombat Own Logo");
		UUID bare = approved(founder, "Wombat Bare Logo");
		// A solution imported from the old platform carries its logo on its organization only.
		jdbc.sql("update solution set logo_file_id = null where id = ?").param(bare).update();
		UUID organizationLogo = uploaded(founder, "organization_logo", "C:\\brand\\logo-co.png", png(400));
		jdbc.sql("update organization set logo_file_id = ? where id = (select organization_id from solution where id = ?)")
			.param(organizationLogo)
			.param(bare)
			.update();

		String list = body(client.get().uri(DIRECTORY + "?q=wombat").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[?(@.name == 'Wombat Bare Logo')].logoFileId"))
			.containsExactly(organizationLogo.toString());
		// A logo of its own wins.
		assertThat(JsonPath.<List<String>>read(list, "$.items[?(@.name == 'Wombat Own Logo')].logoFileId"))
			.doesNotContain(organizationLogo.toString())
			.doesNotContainNull();
		String page = body(client.get().uri(DIRECTORY + "/wombat-bare-logo").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.logoFileId")).isEqualTo(organizationLogo.toString());
		// Its owners still see that the solution has no logo of its own, so they can give it one.
		assertThat(JsonPath.<Object>read(body(get(founder, MINE + "/" + bare).expectStatus().isOk()), "$.logo")).isNull();
	}

	@Test
	void theDirectoryListsOnlyApprovedListedSolutionsAndAnApprovedUnlistedOneOpensByItsAddress() {
		String founder = approvedOwner("founder@listed.test", "Listed Co");
		UUID claims = approved(founder, "Quokka Claims");
		Map<String, Object> banking = described("Quokka Banking", 0);
		banking.put("industries", List.of("banking_finance"));
		banking.put("focusAreas", List.of("ai_agents"));
		banking.put("maturity", "production");
		approved(founder, "Quokka Banking", banking);
		Map<String, Object> hidden = described("Quokka Hidden", 0);
		hidden.put("listed", false);
		approved(founder, "Quokka Hidden", hidden);
		submitted(founder, "Quokka Waiting");
		create(founder, "Quokka Draft");

		// Anyone reads the directory, without a session.
		String all = body(client.get().uri(DIRECTORY + "?q=QUOKKA").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(all, "$.items[*].name")).containsExactly("Quokka Banking",
				"Quokka Claims");
		assertThat(JsonPath.<Integer>read(all, "$.total")).isEqualTo(2);
		assertThat(JsonPath.<String>read(all, "$.items[0].organizationName")).isEqualTo("Listed Co");
		// The directory narrows to one organization by the address of its public page.
		String organization = JsonPath.read(all, "$.items[0].organizationSlug");
		assertThat(names(DIRECTORY + "?organization=" + organization)).containsExactly("Quokka Banking",
				"Quokka Claims");
		assertThat(names(DIRECTORY + "?organization=nobody-here")).isEmpty();
		// Anyone reads the page of an approved organization.
		assertThat(JsonPath.<String>read(body(client.get()
			.uri("/api/organization/organizations/" + organization)
			.exchange()
			.expectStatus()
			.isOk()), "$.name")).isEqualTo("Listed Co");
		assertProblem(client.get().uri("/api/organization/organizations/nobody-here").exchange(), 404,
				"ORGANIZATION_NOT_FOUND");
		assertThat(names(DIRECTORY + "?q=quokka&industry=banking_finance")).containsExactly("Quokka Banking");
		assertThat(names(DIRECTORY + "?q=quokka&focusArea=document_processing")).containsExactly("Quokka Claims");
		assertThat(names(DIRECTORY + "?q=quokka&maturity=production")).containsExactly("Quokka Banking");
		// The most recently approved comes first when that order is asked for.
		assertThat(names(DIRECTORY + "?q=quokka&sort=newest")).containsExactly("Quokka Banking", "Quokka Claims");
		assertProblem(client.get().uri(DIRECTORY + "?industry=gardening").exchange(), 400, "REQUEST_INVALID");
		assertProblem(client.get().uri(DIRECTORY + "?sort=random").exchange(), 400, "REQUEST_INVALID");

		String one = body(client.get().uri(DIRECTORY + "/quokka-claims").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.summary")).isEqualTo("Reads claim files.");
		assertThat(JsonPath.<String>read(one, "$.country")).isEqualTo("VN");
		// The demo is a link the owners gave, there is no deck yet, and a listed solution says it is listed.
		assertThat(JsonPath.<String>read(one, "$.demoUrl")).isEqualTo("https://example.test/demo");
		assertThat(JsonPath.<Object>read(one, "$.deck")).isNull();
		assertThat(JsonPath.<Boolean>read(one, "$.listed")).isTrue();
		// An approved solution left unlisted is out of the directory but opens by its address, and says so.
		assertThat(JsonPath.<Boolean>read(
				body(client.get().uri(DIRECTORY + "/quokka-hidden").exchange().expectStatus().isOk()), "$.listed"))
			.isFalse();
		// An address does not reveal a solution that is not approved.
		for (String slug : List.of("quokka-waiting", "quokka-draft")) {
			assertProblem(client.get().uri(DIRECTORY + "/" + slug).exchange(), 404, "SOLUTION_NOT_FOUND");
		}

		// Operators read everything that was sent, those that wait first, and never a draft.
		String forOperators = body(get(operator, ADMIN + "?q=quokka").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(forOperators, "$.total")).isEqualTo(4);
		assertThat(JsonPath.<String>read(forOperators, "$.items[0].name")).isEqualTo("Quokka Waiting");
		assertThat(JsonPath.<List<String>>read(body(get(operator, ADMIN + "?q=quokka&status=in_review").expectStatus()
			.isOk()), "$.items[*].name")).containsExactly("Quokka Waiting");
		assertProblem(get(founder, ADMIN), 403, "IDENTITY_OPERATOR_REQUIRED");

		// A change to an approved solution shows at once.
		String current = body(get(founder, MINE + "/" + claims).expectStatus().isOk());
		Map<String, Object> renamed = keeping(current, described("Quokka Claims", versionOf(current)));
		renamed.put("summary", "Reads claim files and flags gaps.");
		put(founder, MINE + "/" + claims, renamed).expectStatus().isOk();
		assertThat(JsonPath.<String>read(
				body(client.get().uri(DIRECTORY + "/quokka-claims").exchange().expectStatus().isOk()), "$.summary"))
			.isEqualTo("Reads claim files and flags gaps.");
	}

	@Test
	void whatTheEditorHoldsBeyondTheNeededFieldsIsKeptAndShown() {
		String founder = approvedOwner("founder@fields.test", "Fields Co");
		Map<String, Object> filled = described("Numbat Desk", 0);
		filled.put("traction", "  Three pilots with insurers.  ");
		filled.put("builtWith", List.of(" Python ", "PostgreSQL", "Python"));
		filled.put("languages", List.of("vi", "en", "vi"));
		filled.put("bestCustomerProfile", "Insurers with a claims team of twenty or more.");
		UUID id = approved(founder, "Numbat Desk", filled);

		String mine = body(get(founder, MINE + "/" + id).expectStatus().isOk());
		// What a person typed is trimmed, and a name or a code counts once.
		assertThat(JsonPath.<String>read(mine, "$.traction")).isEqualTo("Three pilots with insurers.");
		assertThat(JsonPath.<List<String>>read(mine, "$.builtWith")).containsExactly("Python", "PostgreSQL");
		assertThat(JsonPath.<List<String>>read(mine, "$.languages")).containsExactly("vi", "en");
		String page = body(client.get().uri(DIRECTORY + "/numbat-desk").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(page, "$.builtWith")).containsExactly("Python", "PostgreSQL");
		assertThat(JsonPath.<List<String>>read(page, "$.languages")).containsExactly("vi", "en");
		assertThat(JsonPath.<String>read(page, "$.bestCustomerProfile"))
			.isEqualTo("Insurers with a claims team of twenty or more.");
		assertThat(JsonPath.<String>read(page, "$.traction")).isEqualTo("Three pilots with insurers.");
		// None of them is needed: a solution without them is still complete.
		assertThat(JsonPath.<Boolean>read(body(get(founder, MINE + "/" + approved(founder, "Numbat Plain")).expectStatus()
			.isOk()), "$.complete")).isTrue();
	}

	@Test
	void importedV1DetailsStaySeparateFromOperatorBackingAndReviewedCustomerDeployments() {
		String founder = approvedOwner("founder@v1-details.test", "V1 Details Co");
		UUID id = approved(founder, "V1 Detail Desk");
		jdbc.sql("""
				update solution
				set product_names = array['Revve AI']::text[],
				    core_technology = ?,
				    infrastructure_used = ?,
				    segment_focus = array['B2B', 'B2B2C']::text[],
				    notable_paying_customers = ?,
				    use_case_industries = array['Banking', 'FnB']::text[],
				    use_case_descriptions = ?,
				    monetization_model = ?,
				    company_funding_status = ?,
				    company_funding_raised = null,
				    competitors = ?,
				    built_with = array['OpenAI', 'Claude']::text[],
				    traction = ?,
				    funding = ?,
				    backing_updated_at = now()
				where id = ?
				""")
			.params("OpenAI and Claude with a proprietary agent framework.", "AWS, Google Cloud",
					"VIB, EagleView", "Banking: voice automation", "Subscription (e.g., SaaS)",
					"Bootstrapped", "11x, Bland", "US enterprise customers; Vietnam bank proof of concept.",
					"Seed (GenAI Fund)", id)
			.update();
		jdbc.sql("""
				update organization
				set founded_year = 2024, team_size = null, company_size_label = '1–19 employees'
				where id = (select organization_id from solution where id = ?)
				""")
			.param(id)
			.update();

		String page = body(client.get().uri(DIRECTORY + "/v1-detail-desk").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(page, "$.productNames")).containsExactly("Revve AI");
		assertThat(JsonPath.<String>read(page, "$.coreTechnology"))
			.isEqualTo("OpenAI and Claude with a proprietary agent framework.");
		assertThat(JsonPath.<String>read(page, "$.infrastructureUsed")).isEqualTo("AWS, Google Cloud");
		assertThat(JsonPath.<List<String>>read(page, "$.segmentFocus")).containsExactly("B2B", "B2B2C");
		assertThat(JsonPath.<String>read(page, "$.notablePayingCustomers")).isEqualTo("VIB, EagleView");
		assertThat(JsonPath.<List<String>>read(page, "$.useCaseIndustries")).containsExactly("Banking", "FnB");
		assertThat(JsonPath.<String>read(page, "$.useCaseDescriptions")).isEqualTo("Banking: voice automation");
		assertThat(JsonPath.<String>read(page, "$.monetizationModel")).isEqualTo("Subscription (e.g., SaaS)");
		assertThat(JsonPath.<String>read(page, "$.companyFundingStatus")).isEqualTo("Bootstrapped");
		assertThat(JsonPath.<Object>read(page, "$.companyFundingRaised")).isNull();
		assertThat(JsonPath.<String>read(page, "$.competitors")).isEqualTo("11x, Bland");
		assertThat(JsonPath.<String>read(page, "$.traction"))
			.isEqualTo("US enterprise customers; Vietnam bank proof of concept.");
		assertThat(JsonPath.<Integer>read(page, "$.organizationFoundedYear")).isEqualTo(2024);
		assertThat(JsonPath.<String>read(page, "$.organizationCompanySizeLabel")).isEqualTo("1–19 employees");
		assertThat(JsonPath.<Object>read(page, "$.organizationTeamSize")).isNull();
		assertThat(JsonPath.<String>read(page, "$.backing.funding")).isEqualTo("Seed (GenAI Fund)");
		assertThat(JsonPath.<List<Object>>read(page, "$.customerDeployments")).isEmpty();
	}

	@Test
	void aDeckIsAPdfOfTheCallerNamedByOneSolutionAndRemovedWhenItIsReplaced() {
		String founder = approvedOwner("founder@decks.test", "Decks Co");
		UUID id = create(founder, "Bilby Desk");
		byte[] pdf = pdf(900);
		UUID first = uploaded(founder, "solution_deck", "C:\\decks\\bilby.pdf", pdf);

		Map<String, Object> request = described("Bilby Desk", 0);
		request.put("deckFileId", first);
		String saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<String>read(saved, "$.deck.fileId")).isEqualTo(first.toString());
		assertThat(JsonPath.<String>read(saved, "$.deck.fileName")).isEqualTo("bilby.pdf");
		assertThat(JsonPath.<Integer>read(saved, "$.deck.sizeBytes")).isEqualTo(900);
		assertThat(JsonPath.<String>read(saved, "$.deck.attachedAt")).isNotNull();
		// Saving again with the deck it has changes nothing about the file.
		request.put("version", versionOf(saved));
		saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(stored(first)).isTrue();

		// A file of another purpose, another account's deck and the deck of another solution are refused.
		String colleague = approvedOwner("founder@other-decks.test", "Other Decks Co");
		UUID other = create(colleague, "Bilby Rival");
		for (UUID notUsable : List.of(uploaded(founder, "application_file", "proposal.pdf", pdf),
				uploaded(colleague, "solution_deck", "theirs.pdf", pdf), UUID.randomUUID())) {
			request.put("version", versionOf(saved));
			request.put("deckFileId", notUsable);
			assertProblem(put(founder, MINE + "/" + id, request), 400, "SOLUTION_DECK_NOT_USABLE");
		}
		UUID second = create(founder, "Bilby Second");
		Map<String, Object> borrowed = described("Bilby Second", 0);
		borrowed.put("deckFileId", first);
		assertProblem(put(founder, MINE + "/" + second, borrowed), 400, "SOLUTION_DECK_NOT_USABLE");
		assertProblem(put(colleague, MINE + "/" + other, borrowed), 400, "SOLUTION_DECK_NOT_USABLE");

		// A replaced deck goes from the store, and so does a removed one and the deck of a deleted draft.
		UUID replacement = uploaded(founder, "solution_deck", "bilby-v2.pdf", pdf(1200));
		request.put("version", versionOf(saved));
		request.put("deckFileId", replacement);
		saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<String>read(saved, "$.deck.fileName")).isEqualTo("bilby-v2.pdf");
		assertThat(stored(first)).isFalse();
		assertThat(stored(replacement)).isTrue();
		request.put("version", versionOf(saved));
		request.put("deckFileId", null);
		saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(saved, "$.deck")).isNull();
		assertThat(stored(replacement)).isFalse();
		UUID last = uploaded(founder, "solution_deck", "bilby-v3.pdf", pdf);
		request.put("version", versionOf(saved));
		request.put("deckFileId", last);
		put(founder, MINE + "/" + id, request).expectStatus().isOk();
		delete(founder, MINE + "/" + id).expectStatus().isNoContent();
		assertThat(stored(last)).isFalse();
	}

	@Test
	void aSolutionShowsALogoACoverAndUpToFourImagesOfItsOwn() {
		String founder = approvedOwner("founder@pictures.test", "Pictures Co");
		UUID id = create(founder, "Possum Desk");
		UUID logo = uploaded(founder, "solution_logo", "C:\\brand\\possum-logo.png", png(400));
		UUID cover = uploaded(founder, "solution_image", "possum-cover.png", png(1500));
		UUID first = uploaded(founder, "solution_image", "inbox.png", png(700));
		UUID second = uploaded(founder, "solution_image", "report.png", png(800));

		Map<String, Object> request = described("Possum Desk", 0);
		request.put("logoFileId", logo);
		request.put("coverFileId", cover);
		request.put("imageFileIds", List.of(first, second));
		String saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<String>read(saved, "$.logo.fileId")).isEqualTo(logo.toString());
		assertThat(JsonPath.<String>read(saved, "$.logo.fileName")).isEqualTo("possum-logo.png");
		assertThat(JsonPath.<Integer>read(saved, "$.logo.sizeBytes")).isEqualTo(400);
		assertThat(JsonPath.<String>read(saved, "$.cover.fileName")).isEqualTo("possum-cover.png");
		assertThat(JsonPath.<List<String>>read(saved, "$.images[*].fileName")).containsExactly("inbox.png", "report.png");

		// What is not an image for that place is refused: a file of another kind, another account's upload, a file
		// that does not exist, an image named twice, and more than four.
		String rival = approvedOwner("founder@other-pictures.test", "Other Pictures Co");
		UUID theirs = uploaded(rival, "solution_image", "theirs.png", png(600));
		UUID third = uploaded(founder, "solution_image", "third.png", png(600));
		List<Map<String, Object>> refused = List.of(Map.of("logoFileId", third), Map.of("coverFileId", logo),
				Map.of("coverFileId", theirs), Map.of("coverFileId", UUID.randomUUID()),
				Map.of("imageFileIds", List.of(first, first)), Map.of("imageFileIds", List.of(first, cover)));
		for (Map<String, Object> change : refused) {
			Map<String, Object> changed = new HashMap<>(request);
			changed.putAll(change);
			changed.put("version", versionOf(saved));
			assertProblem(put(founder, MINE + "/" + id, changed), 400, "SOLUTION_IMAGE_NOT_USABLE");
		}
		Map<String, Object> tooMany = new HashMap<>(request);
		tooMany.put("imageFileIds", List.of(first, second, third, UUID.randomUUID(), UUID.randomUUID()));
		tooMany.put("version", versionOf(saved));
		assertProblem(put(founder, MINE + "/" + id, tooMany), 400, "REQUEST_INVALID");
		// An image belongs to one solution.
		Map<String, Object> borrowed = described("Possum Second", 0);
		borrowed.put("coverFileId", cover);
		assertProblem(put(founder, MINE + "/" + create(founder, "Possum Second"), borrowed), 400,
				"SOLUTION_IMAGE_NOT_USABLE");

		// A colleague saves what a founder uploaded: an image the solution has stays, whoever uploaded it. The images
		// change their order, and the cover changes place with one of them.
		String colleague = signIn("colleague@pictures.test");
		post(founder, ORGANIZATION + "/mine/invitations", Map.of("email", "colleague@pictures.test", "role", "member"))
			.expectStatus()
			.isNoContent();
		String invitation = JsonPath.read(body(get(colleague, ORGANIZATION + "/mine").expectStatus().isOk()),
				"$.invitations[0].id");
		post(colleague, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
		request.put("coverFileId", second);
		request.put("imageFileIds", List.of(cover, first));
		request.put("version", versionOf(saved));
		saved = body(put(colleague, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(JsonPath.<String>read(saved, "$.cover.fileName")).isEqualTo("report.png");
		assertThat(JsonPath.<List<String>>read(saved, "$.images[*].fileName")).containsExactly("possum-cover.png",
				"inbox.png");
		assertThat(List.of(logo, cover, first, second)).allMatch(this::stored);

		// An image the solution stops naming goes from the store; the others stay.
		request.put("imageFileIds", List.of(cover));
		request.put("version", versionOf(saved));
		saved = body(put(founder, MINE + "/" + id, request).expectStatus().isOk());
		assertThat(stored(first)).isFalse();
		assertThat(List.of(logo, cover, second)).allMatch(this::stored);

		// Approved, anyone reads them: the card of the directory has the logo and the cover, the page has every image,
		// and their bytes need no session.
		post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		String card = body(client.get().uri(DIRECTORY + "?q=possum").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(card, "$.items[0].logoFileId")).isEqualTo(logo.toString());
		assertThat(JsonPath.<String>read(card, "$.items[0].coverFileId")).isEqualTo(second.toString());
		String page = body(client.get().uri(DIRECTORY + "/possum-desk").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.logoFileId")).isEqualTo(logo.toString());
		assertThat(JsonPath.<String>read(page, "$.coverFileId")).isEqualTo(second.toString());
		assertThat(JsonPath.<List<String>>read(page, "$.imageFileIds")).containsExactly(cover.toString());
		client.get()
			.uri("/api/storage/files/" + second)
			.exchange()
			.expectStatus()
			.isOk()
			.expectHeader()
			.contentType(MediaType.IMAGE_PNG);
		// The operators see what the organization sees.
		assertThat(JsonPath.<String>read(body(get(operator, ADMIN + "/" + id).expectStatus().isOk()), "$.cover.fileName"))
			.isEqualTo("report.png");

		// A deleted draft takes its images with it.
		UUID draft = create(founder, "Possum Draft");
		Map<String, Object> sketch = pictured(founder, described("Possum Draft", 0));
		put(founder, MINE + "/" + draft, sketch).expectStatus().isOk();
		delete(founder, MINE + "/" + draft).expectStatus().isNoContent();
		assertThat(stored(UUID.fromString(sketch.get("logoFileId").toString()))).isFalse();
		assertThat(stored(UUID.fromString(sketch.get("coverFileId").toString()))).isFalse();
	}

	@Test
	void onlyAnOperatorWritesWhatGenAiFundSaysOfASolution() {
		String founder = approvedOwner("founder@backing.test", "Backing Co");
		Map<String, Object> described = described("Bandicoot Desk", 0);
		described.put("channels", "  Voice and chat  ");
		UUID id = approved(founder, "Bandicoot Desk", described);
		String backing = ADMIN + "/" + id + "/backing";
		String address = DIRECTORY + "/bandicoot-desk";

		// Its owners write the channels it works through; what GenAI Fund says of it is not theirs to write.
		String page = body(client.get().uri(address).exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.channels")).isEqualTo("Voice and chat");
		assertThat(JsonPath.<Object>read(page, "$.backing")).isNull();
		assertProblem(put(founder, backing, Map.of("program", "A programme of our own")), 403,
				"IDENTITY_OPERATOR_REQUIRED");

		put(operator, backing,
				Map.of("backedBy", "GenAI Fund portfolio", "program", " FastTrack AI Accelerator, Cohort 1 "))
			.expectStatus()
			.isNoContent();
		page = body(client.get().uri(address).exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.backing.backedBy")).isEqualTo("GenAI Fund portfolio");
		assertThat(JsonPath.<String>read(page, "$.backing.program")).isEqualTo("FastTrack AI Accelerator, Cohort 1");
		assertThat(JsonPath.<Object>read(page, "$.backing.funding")).isNull();
		assertThat(JsonPath.<String>read(page, "$.backing.updatedAt")).isNotNull();
		// A card says the programme, or else who backs the company.
		String card = DIRECTORY + "?q=bandicoot";
		assertThat(JsonPath.<String>read(body(client.get().uri(card).exchange().expectStatus().isOk()),
				"$.items[0].backing"))
			.isEqualTo("FastTrack AI Accelerator, Cohort 1");
		assertThat(events(id)).contains("solution.back");

		// A save by its owners leaves it as GenAI Fund wrote it.
		String mine = body(get(founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(mine, "$.backing.backedBy")).isEqualTo("GenAI Fund portfolio");
		put(founder, MINE + "/" + id, keeping(mine, described("Bandicoot Desk", versionOf(mine)))).expectStatus().isOk();
		put(operator, backing, Map.of("backedBy", "GenAI Fund portfolio")).expectStatus().isNoContent();
		assertThat(JsonPath.<String>read(body(client.get().uri(card).exchange().expectStatus().isOk()),
				"$.items[0].backing"))
			.isEqualTo("GenAI Fund portfolio");

		// Emptied, it is gone. A draft has none to write, and a line has its length.
		put(operator, backing, Map.of("backedBy", " ")).expectStatus().isNoContent();
		assertThat(JsonPath.<Object>read(body(client.get().uri(address).exchange().expectStatus().isOk()), "$.backing"))
			.isNull();
		assertProblem(put(operator, ADMIN + "/" + create(founder, "Bandicoot Draft") + "/backing",
				Map.of("program", "FastTrack")), 404, "SOLUTION_NOT_FOUND");
		assertProblem(put(operator, backing, Map.of("program", "x".repeat(121))), 400, "REQUEST_INVALID");
	}

	@Test
	void aDeckIsReadByItsOrganizationAndTheOperatorsUntilApprovalAndByAnyoneAfter() {
		String founder = approvedOwner("founder@readers.test", "Readers Co");
		String colleague = signIn("colleague@readers.test");
		post(founder, ORGANIZATION + "/mine/invitations", Map.of("email", "colleague@readers.test", "role", "member"))
			.expectStatus()
			.isNoContent();
		String invitation = JsonPath.read(body(get(colleague, ORGANIZATION + "/mine").expectStatus().isOk()),
				"$.invitations[0].id");
		post(colleague, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
		String outsider = approvedOwner("founder@outsiders.test", "Outsiders Co");
		byte[] pdf = pdf(700);
		String deck = DIRECTORY + "/quoll-desk/deck";

		String draft = body(post(founder, MINE, Map.of("name", "Quoll Desk")).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		// A solution without a deck has none to read, for anyone.
		assertProblem(get(founder, deck), 404, "SOLUTION_NOT_FOUND");
		Map<String, Object> request = pictured(founder, described("Quoll Desk", versionOf(draft)));
		request.put("deckFileId", uploaded(founder, "solution_deck", "quoll.pdf", pdf));
		put(founder, MINE + "/" + id, request).expectStatus().isOk();

		// A draft is its organization's alone: an owner and a member read the deck, nobody else.
		get(founder, deck).expectStatus()
			.isOk()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PDF)
			.expectHeader()
			.valueMatches(HttpHeaders.CONTENT_DISPOSITION, "attachment;.*quoll\\.pdf.*")
			.expectBody(byte[].class)
			.isEqualTo(pdf);
		get(colleague, deck).expectStatus().isOk();
		assertProblem(client.get().uri(deck).exchange(), 404, "SOLUTION_NOT_FOUND");
		assertProblem(get(outsider, deck), 404, "SOLUTION_NOT_FOUND");
		assertProblem(get(operator, deck), 404, "SOLUTION_NOT_FOUND");

		// Sent for review, the operators read it too; the public still does not.
		post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk();
		get(operator, deck).expectStatus().isOk();
		assertThat(JsonPath.<String>read(body(get(operator, ADMIN + "/" + id).expectStatus().isOk()), "$.deck.fileName"))
			.isEqualTo("quoll.pdf");
		assertProblem(client.get().uri(deck).exchange(), 404, "SOLUTION_NOT_FOUND");
		assertProblem(get(outsider, deck), 404, "SOLUTION_NOT_FOUND");

		// Approved, anyone reads it, and its page says what it is called and how large it is.
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		client.get().uri(deck).exchange().expectStatus().isOk().expectBody(byte[].class).isEqualTo(pdf);
		String page = body(client.get().uri(DIRECTORY + "/quoll-desk").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.deck.fileName")).isEqualTo("quoll.pdf");
		assertThat(JsonPath.<Integer>read(page, "$.deck.sizeBytes")).isEqualTo(700);

		// Taken down, it is the organization's and the operators' again.
		post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "unverifiable")).expectStatus().isNoContent();
		assertProblem(client.get().uri(deck).exchange(), 404, "SOLUTION_NOT_FOUND");
		get(founder, deck).expectStatus().isOk();
		get(operator, deck).expectStatus().isOk();
	}

	@Test
	void aCustomerDeploymentIsReviewedBeforeAnyoneElseReadsIt() {
		String founder = approvedOwner("founder@deployers.test", "Deployers Co");
		UUID solution = approved(founder, "Wombat Desk");
		String deployments = MINE + "/" + solution + "/deployments";
		String page = DIRECTORY + "/wombat-desk";

		long waiting = deploymentsWaiting();
		assertProblem(post(founder, deployments, Map.of("title", "No customer")), 400, "REQUEST_INVALID");
		String added = body(post(founder, deployments, deployment("Card enquiries", null)).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(added, "$.id"));
		assertThat(JsonPath.<String>read(added, "$.status")).isEqualTo("in_review");
		// Its organization and the operators read it; the public does not yet.
		assertThat(JsonPath.<List<String>>read(body(get(founder, MINE + "/" + solution).expectStatus().isOk()),
				"$.customerDeployments[*].title"))
			.containsExactly("Card enquiries");
		String queue = body(get(operator, ADMIN + "?q=Wombat").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(queue, "$.items[0].deploymentsAwaitingReview")).isEqualTo(1);
		// The count of what waits is not narrowed by the search.
		assertThat(deploymentsWaiting()).isEqualTo(waiting + 1);
		assertThat(JsonPath.<List<Object>>read(body(client.get().uri(page).exchange().expectStatus().isOk()),
				"$.customerDeployments"))
			.isEmpty();

		String review = "/api/solution/admin/deployments/" + id;
		assertProblem(post(founder, review + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		post(operator, review + "/approve", null).expectStatus().isNoContent();
		assertProblem(post(operator, review + "/approve", null), 409, "SOLUTION_DEPLOYMENT_NOT_AWAITING_REVIEW");
		assertThat(deploymentsWaiting()).isEqualTo(waiting);
		String shown = body(client.get().uri(page).exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(shown, "$.customerDeployments[0].customer")).isEqualTo("A retail bank");
		assertThat(JsonPath.<Integer>read(body(client.get().uri(DIRECTORY + "?q=Wombat").exchange().expectStatus().isOk()),
				"$.items[0].customerDeployments"))
			.isEqualTo(1);
		String organization = JsonPath.read(shown, "$.organizationSlug");
		String ofOrganization = body(client.get()
			.uri("/api/solution/deployments?organization=" + organization)
			.exchange()
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(ofOrganization, "$.items[0].solutionSlug")).isEqualTo("wombat-desk");
		assertThat(JsonPath.<Integer>read(ofOrganization, "$.total")).isEqualTo(1);

		// A change is a new claim: it leaves the page until an operator has read it.
		assertProblem(put(founder, deployments + "/" + id, deployment("Card and loan enquiries", 7L)), 409,
				"SOLUTION_DEPLOYMENT_CHANGED_MEANWHILE");
		String current = body(get(founder, MINE + "/" + solution).expectStatus().isOk());
		long version = JsonPath.<Number>read(current, "$.customerDeployments[0].version").longValue();
		put(founder, deployments + "/" + id, deployment("Card and loan enquiries", version)).expectStatus().isOk();
		assertThat(JsonPath.<List<Object>>read(body(client.get().uri(page).exchange().expectStatus().isOk()),
				"$.customerDeployments"))
			.isEmpty();

		post(operator, review + "/reject", Map.of("reason", "unverifiable", "message", "Name the bank to us."))
			.expectStatus()
			.isNoContent();
		String rejected = body(get(founder, MINE + "/" + solution).expectStatus().isOk());
		assertThat(JsonPath.<String>read(rejected, "$.customerDeployments[0].decisionMessage"))
			.isEqualTo("Name the bank to us.");
		assertThat(jdbc.sql("select action from audit_event where resource_id = ? order by occurred_at, id")
			.param(id.toString())
			.query(String.class)
			.list()).containsExactly("solution.deployment_approve", "solution.deployment_reject");

		// Another organization cannot touch it, and its owners remove it.
		String other = approvedOwner("founder@bystanders.test", "Bystanders Co");
		assertProblem(delete(other, deployments + "/" + id), 404, "SOLUTION_NOT_FOUND");
		delete(founder, deployments + "/" + id).expectStatus().isNoContent();
		assertProblem(delete(founder, deployments + "/" + id), 404, "SOLUTION_DEPLOYMENT_NOT_FOUND");
	}

	@Test
	void everythingButTheDirectoryNeedsASession() {
		client.get().uri(DIRECTORY).exchange().expectStatus().isOk();

		client.get().uri(MINE).exchange().expectStatus().isUnauthorized();
		client.get().uri(ADMIN).exchange().expectStatus().isUnauthorized();
		client.post()
			.uri(MINE)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", "By Nobody"))
			.exchange()
			.expectStatus()
			.isUnauthorized();
	}

	/** A solution as its edit screen sends it, with what a submission needs. */
	private static Map<String, Object> described(String name, long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("summary", "Reads claim files.");
		request.put("problemsSolved", null);
		request.put("valueProposition", null);
		request.put("focusAreas", List.of("document_processing"));
		request.put("industries", List.of("insurance"));
		request.put("maturity", "pilot");
		request.put("traction", null);
		request.put("builtWith", List.of());
		request.put("languages", List.of());
		request.put("deployment", List.of("cloud_saas"));
		request.put("bestCustomerProfile", null);
		request.put("website", "https://example.test");
		request.put("demoUrl", "https://example.test/demo");
		request.put("deckFileId", null);
		request.put("logoFileId", null);
		request.put("coverFileId", null);
		request.put("imageFileIds", List.of());
		request.put("listed", true);
		request.put("version", version);
		return request;
	}

	/** The request with a logo and a cover the account of the session uploads for it, as a review asks. */
	private Map<String, Object> pictured(String session, Map<String, Object> request) {
		request.put("logoFileId", uploaded(session, "solution_logo", "logo.png", png(300)));
		request.put("coverFileId", uploaded(session, "solution_image", "cover.png", png(900)));
		return request;
	}

	/** The request with the images the solution was last answered with, so a save keeps them. */
	private static Map<String, Object> keeping(String solution, Map<String, Object> request) {
		request.put("logoFileId", JsonPath.<String>read(solution, "$.logo.fileId"));
		request.put("coverFileId", JsonPath.<String>read(solution, "$.cover.fileId"));
		request.put("imageFileIds", JsonPath.<List<String>>read(solution, "$.images[*].fileId"));
		return request;
	}

	private static Map<String, Object> deployment(String title, Long version) {
		Map<String, Object> deployment = new HashMap<>();
		deployment.put("title", title);
		deployment.put("customer", "A retail bank");
		deployment.put("problem", "Enquiries filled the queue.");
		deployment.put("delivered", "A voice agent that answers the common questions.");
		deployment.put("stage", "production");
		deployment.put("version", version);
		return deployment;
	}

	/** A PDF of the given length. */
	private static byte[] pdf(int length) {
		byte[] content = Arrays.copyOf("%PDF-1.7\n".getBytes(US_ASCII), length);
		Arrays.fill(content, 9, length, (byte) 'x');
		return content;
	}

	/** A PNG of the given length. */
	private static byte[] png(int length) {
		byte[] content = Arrays.copyOf(new byte[] { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' }, length);
		Arrays.fill(content, 8, length, (byte) 'x');
		return content;
	}

	/** Uploads a file in the three requests of the storage module and returns the stored file. */
	private UUID uploaded(String session, String purpose, String fileName, byte[] content) {
		String ticket = body(post(session, "/api/storage/uploads", Map.of("purpose", purpose, "fileName", fileName,
				"mediaType", fileName.endsWith(".png") ? "image/png" : "application/pdf", "sizeBytes", content.length))
			.expectStatus()
			.isCreated());
		UUID id = UUID.fromString(JsonPath.read(ticket, "$.id"));
		client.put()
			.uri(JsonPath.<String>read(ticket, "$.url"))
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_OCTET_STREAM)
			.body(content)
			.exchange()
			.expectStatus()
			.isNoContent();
		post(session, "/api/storage/uploads/" + id + "/confirm", null).expectStatus().isOk();
		return id;
	}

	/** Whether the storage module still has the file. */
	private boolean stored(UUID file) {
		return jdbc.sql("select count(*) from storage_file where id = ?").param(file).query(Long.class).single() == 1;
	}

	private UUID organizationOf(String session) {
		return UUID.fromString(
				JsonPath.read(body(get(session, ORGANIZATION + "/mine").expectStatus().isOk()), "$.organization.id"));
	}

	private static long versionOf(String solution) {
		return JsonPath.<Number>read(solution, "$.version").longValue();
	}

	private UUID organization(String session, String name) {
		return UUID.fromString(JsonPath.read(body(post(session, ORGANIZATION + "/organizations",
				Map.of("name", name, "type", "company", "country", "VN", "teamSize", "2_9",
						"industries", List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
	}

	private void approve(UUID organization) {
		post(operator, ORGANIZATION + "/admin/organizations/" + organization + "/approve", Map.of()).expectStatus()
			.isNoContent();
	}

	/** The session of an owner of an approved organization. */
	private String approvedOwner(String email, String name) {
		String session = signIn(email);
		approve(organization(session, name));
		return session;
	}

	private UUID create(String session, String name) {
		return UUID.fromString(
				JsonPath.read(body(post(session, MINE, Map.of("name", name)).expectStatus().isCreated()), "$.id"));
	}

	private UUID submitted(String session, String name) {
		return submitted(session, name, described(name, 0));
	}

	private UUID submitted(String session, String name, Map<String, Object> description) {
		String draft = body(post(session, MINE, Map.of("name", name)).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		description.put("version", versionOf(draft));
		if (description.get("logoFileId") == null) {
			pictured(session, description);
		}
		put(session, MINE + "/" + id, description).expectStatus().isOk();
		post(session, MINE + "/" + id + "/submit", null).expectStatus().isOk();
		return id;
	}

	private UUID approved(String session, String name) {
		return approved(session, name, described(name, 0));
	}

	private UUID approved(String session, String name, Map<String, Object> description) {
		UUID id = submitted(session, name, description);
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		return id;
	}

	private List<String> names(String path) {
		return JsonPath.read(body(client.get().uri(path).exchange().expectStatus().isOk()), "$.items[*].name");
	}

	private List<String> names(String session, String path) {
		return JsonPath.read(body(get(session, path).expectStatus().isOk()), "$.items[*].name");
	}

	private long deploymentsWaiting() {
		return JsonPath
			.<Number>read(body(get(operator, ADMIN + "?q=nothing-is-named-so").expectStatus().isOk()),
					"$.deploymentsAwaitingReview")
			.longValue();
	}

	private RestTestClient.ResponseSpec get(String session, String path) {
		return client.get().uri(path).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private RestTestClient.ResponseSpec post(String session, String path, Object body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		return body == null ? request.exchange() : request.contentType(MediaType.APPLICATION_JSON).body(body).exchange();
	}

	private RestTestClient.ResponseSpec put(String session, String path, Object body) {
		return client.put()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange();
	}

	private RestTestClient.ResponseSpec delete(String session, String path) {
		return client.delete()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	private String signIn(String email) {
		return TestSignIn.session(client, mail, email);
	}

	private List<String> events(UUID solution) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'solution' and resource_id = ?
				order by occurred_at, id
				""").param(solution.toString()).query(String.class).list();
	}

	private static void assertProblem(RestTestClient.ResponseSpec response, int status, String code) {
		response.expectStatus()
			.isEqualTo(status)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo(code)
			.jsonPath("$.requestId")
			.isNotEmpty();
	}

	/**
	 * The test mailbox, imported through a class of this test's own so that the test keeps a Spring context, and with
	 * it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
