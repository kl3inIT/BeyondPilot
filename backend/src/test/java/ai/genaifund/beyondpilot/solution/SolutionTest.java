package ai.genaifund.beyondpilot.solution;

import static java.nio.charset.StandardCharsets.US_ASCII;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.RecordingMailSender;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
	private RecordingMailSender mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = signIn("operator@genaifund.test");
	}

	@Test
	void everyMemberOfAProviderWritesWhetherOrNotGenAiFundHasReviewedIt() {
		String founder = signIn("founder@writers.test");
		UUID organization = organization(founder, "Writers Co", "provider");

		// Review decides what is listed, not who takes part: an organization that waits for review writes already.
		UUID solution = create(founder, "Writers Desk");
		submitted(founder, "Writers Draft");
		String forFounder = body(get(founder, MINE).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(forFounder, "$.editable")).isTrue();

		approve(organization);
		String colleague = signIn("colleague@writers.test");
		post(colleague, ORGANIZATION + "/organizations/" + organization + "/join", Map.of()).expectStatus().isOk();
		String forMember = body(get(colleague, MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(forMember, "$.items[*].name")).contains("Writers Desk");
		assertThat(JsonPath.<Boolean>read(forMember, "$.editable")).isTrue();
		String bySaved = body(put(colleague, MINE + "/" + solution, described("Writers Desk", 0)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(bySaved, "$.summary")).isNotBlank();
		create(colleague, "By A Member");

		String buyer = signIn("buyer@enterprise-only.test");
		approve(organization(buyer, "Enterprise Only", "enterprise"));
		assertProblem(post(buyer, MINE, Map.of("name", "By An Enterprise")), 403, "SOLUTION_PROVIDER_REQUIRED");
		// Another organization does not see it at all.
		assertProblem(get(buyer, MINE + "/" + solution), 404, "SOLUTION_NOT_FOUND");

		String nobody = body(get(signIn("nobody@elsewhere.test"), MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<Object>>read(nobody, "$.items")).isEmpty();
		assertThat(JsonPath.<Boolean>read(nobody, "$.editable")).isFalse();
	}

	@Test
	void aSolutionIsListedOnlyOnceItsOrganizationIsApprovedToo() {
		String founder = signIn("founder@unreviewed.test");
		UUID organization = organization(founder, "Unreviewed Co", "provider");
		UUID solution = submitted(founder, "Unreviewed Desk");

		assertProblem(post(operator, ADMIN + "/" + solution + "/approve", null), 409,
				"SOLUTION_ORGANIZATION_NOT_APPROVED");
		approve(organization);
		post(operator, ADMIN + "/" + solution + "/approve", null).expectStatus().isNoContent();
		assertThat(names(DIRECTORY)).contains("Unreviewed Desk");
	}

	@Test
	void aDraftNeedsOnlyANameAndASubmissionNeedsMore() {
		String founder = provider("founder@drafts.test", "Drafts Co");

		String draft = body(post(founder, MINE, Map.of("name", "  Draft Desk  ")).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		assertThat(JsonPath.<String>read(draft, "$.name")).isEqualTo("Draft Desk");
		assertThat(JsonPath.<String>read(draft, "$.slug")).isEqualTo("draft-desk");
		assertThat(JsonPath.<String>read(draft, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<Boolean>read(draft, "$.complete")).isFalse();
		assertProblem(post(founder, MINE, Map.of("name", " ")), 400, "REQUEST_INVALID");
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 400, "SOLUTION_INCOMPLETE");

		String saved = body(put(founder, MINE + "/" + id, described("Draft Desk", versionOf(draft))).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(saved, "$.complete")).isTrue();
		String submitted = body(post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk());

		assertThat(JsonPath.<String>read(submitted, "$.status")).isEqualTo("submitted");
		assertThat(JsonPath.<String>read(submitted, "$.submittedAt")).isNotNull();
		assertProblem(post(founder, MINE + "/" + id + "/submit", null), 409, "SOLUTION_NOT_SUBMITTABLE");
		// What operators review keeps what a submission needs.
		Map<String, Object> emptied = described("Draft Desk", versionOf(submitted));
		emptied.put("summary", null);
		assertProblem(put(founder, MINE + "/" + id, emptied), 400, "SOLUTION_INCOMPLETE");
	}

	@Test
	void aSaveOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		String founder = provider("founder@bounds.test", "Bounds Co");
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
		String founder = provider("founder@stale.test", "Stale Co");
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
		String founder = provider("founder@deleted.test", "Deleted Co");
		UUID draft = create(founder, "Deleted Desk");
		UUID sent = submitted(founder, "Kept Desk");

		delete(founder, MINE + "/" + draft).expectStatus().isNoContent();

		assertProblem(get(founder, MINE + "/" + draft), 404, "SOLUTION_NOT_FOUND");
		assertProblem(delete(founder, MINE + "/" + sent), 409, "SOLUTION_NOT_A_DRAFT");
		get(founder, MINE + "/" + sent).expectStatus().isOk();
	}

	@Test
	void anOperatorRejectsWithAReasonAndApprovesWhatIsSentAgain() {
		String founder = provider("founder@reviewed.test", "Reviewed Co");
		UUID draft = create(founder, "Unsent Desk");
		UUID id = submitted(founder, "Reviewed Desk");

		assertProblem(post(founder, ADMIN + "/" + id + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		// Operators see what was sent to them, never a draft.
		assertProblem(get(operator, ADMIN + "/" + draft), 404, "SOLUTION_NOT_FOUND");
		assertProblem(post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "boring")), 400, "REQUEST_INVALID");
		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "incomplete", "message", "Say who it is for."))
			.expectStatus()
			.isNoContent();

		String rejected = body(get(founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(rejected, "$.status")).isEqualTo("rejected");
		assertThat(JsonPath.<String>read(rejected, "$.decisionReason")).isEqualTo("incomplete");
		assertThat(JsonPath.<String>read(rejected, "$.decisionMessage")).isEqualTo("Say who it is for.");
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "SOLUTION_NOT_AWAITING_REVIEW");

		post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();

		String approved = body(get(operator, ADMIN + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(approved, "$.organizationName")).isEqualTo("Reviewed Co");
		assertThat(events(id)).containsExactly("solution.reject", "solution.approve");
		// A decision is made once.
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "SOLUTION_NOT_AWAITING_REVIEW");
	}

	@Test
	void theOperatorsListFindsASolutionByItsOrganizationNarrowsByIndustryAndNamesWhoSentIt() {
		String founder = provider("founder@harbour.test", "Harbour Analytics");
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
		String founder = provider("founder@pager.test", "Pager Works");
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
		String founder = provider("founder@earlier.test", "Earlier Co");
		UUID id = submitted(founder, "Earlier Desk");
		// What a solution submitted before the column existed looks like.
		jdbc.sql("update solution set submitted_by_account_id = null where id = ?").param(id).update();

		String listed = body(get(operator, ADMIN + "?q=earlier desk").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(listed, "$.items[*].name")).containsExactly("Earlier Desk");
		assertThat(JsonPath.<String>read(listed, "$.items[0].submittedBy")).isNull();
		assertThat(JsonPath.<String>read(body(get(operator, ADMIN + "/" + id).expectStatus().isOk()), "$.submittedBy"))
			.isNull();
		// The owners read it the same way, and sending it again records who did.
		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "incomplete")).expectStatus().isNoContent();
		String sentAgain = body(post(founder, MINE + "/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(sentAgain, "$.submittedBy")).isEqualTo("founder@earlier.test");
	}

	@Test
	void anOperatorTakesAnApprovedSolutionOutOfTheDirectory() {
		String founder = provider("founder@removed.test", "Removed Co");
		UUID id = approved(founder, "Removed Desk");
		client.get().uri(DIRECTORY + "/removed-desk").exchange().expectStatus().isOk();

		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "unverifiable")).expectStatus().isNoContent();

		assertProblem(client.get().uri(DIRECTORY + "/removed-desk").exchange(), 404, "SOLUTION_NOT_FOUND");
		assertThat(JsonPath.<String>read(body(get(founder, MINE + "/" + id).expectStatus().isOk()), "$.status"))
			.isEqualTo("rejected");
		assertThat(events(id)).containsExactly("solution.approve", "solution.reject");
	}

	@Test
	void theDirectoryListsOnlyApprovedListedSolutionsAndAnApprovedUnlistedOneOpensByItsAddress() {
		String founder = provider("founder@listed.test", "Listed Co");
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
		assertThat(JsonPath.<List<String>>read(body(get(operator, ADMIN + "?q=quokka&status=submitted").expectStatus()
			.isOk()), "$.items[*].name")).containsExactly("Quokka Waiting");
		assertProblem(get(founder, ADMIN), 403, "IDENTITY_OPERATOR_REQUIRED");

		// A change to an approved solution shows at once.
		String current = body(get(founder, MINE + "/" + claims).expectStatus().isOk());
		Map<String, Object> renamed = described("Quokka Claims", versionOf(current));
		renamed.put("summary", "Reads claim files and flags gaps.");
		put(founder, MINE + "/" + claims, renamed).expectStatus().isOk();
		assertThat(JsonPath.<String>read(
				body(client.get().uri(DIRECTORY + "/quokka-claims").exchange().expectStatus().isOk()), "$.summary"))
			.isEqualTo("Reads claim files and flags gaps.");
	}

	@Test
	void whatTheEditorHoldsBeyondTheNeededFieldsIsKeptAndShown() {
		String founder = provider("founder@fields.test", "Fields Co");
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
	void aDeckIsAPdfOfTheCallerNamedByOneSolutionAndRemovedWhenItIsReplaced() {
		String founder = provider("founder@decks.test", "Decks Co");
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
		String colleague = provider("founder@other-decks.test", "Other Decks Co");
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
	void aDeckIsReadByItsOrganizationAndTheOperatorsUntilApprovalAndByAnyoneAfter() {
		String founder = provider("founder@readers.test", "Readers Co");
		String colleague = signIn("colleague@readers.test");
		post(colleague, ORGANIZATION + "/organizations/" + organizationOf(founder) + "/join", Map.of()).expectStatus()
			.isOk();
		String outsider = provider("founder@outsiders.test", "Outsiders Co");
		byte[] pdf = pdf(700);
		String deck = DIRECTORY + "/quoll-desk/deck";

		String draft = body(post(founder, MINE, Map.of("name", "Quoll Desk")).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		// A solution without a deck has none to read, for anyone.
		assertProblem(get(founder, deck), 404, "SOLUTION_NOT_FOUND");
		Map<String, Object> request = described("Quoll Desk", versionOf(draft));
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
		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "unverifiable")).expectStatus().isNoContent();
		assertProblem(client.get().uri(deck).exchange(), 404, "SOLUTION_NOT_FOUND");
		get(founder, deck).expectStatus().isOk();
		get(operator, deck).expectStatus().isOk();
	}

	@Test
	void aCustomerDeploymentIsReviewedBeforeAnyoneElseReadsIt() {
		String founder = provider("founder@deployers.test", "Deployers Co");
		UUID solution = approved(founder, "Wombat Desk");
		String deployments = MINE + "/" + solution + "/deployments";
		String page = DIRECTORY + "/wombat-desk";

		assertProblem(post(founder, deployments, Map.of("title", "No customer")), 400, "REQUEST_INVALID");
		String added = body(post(founder, deployments, deployment("Card enquiries", null)).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(added, "$.id"));
		assertThat(JsonPath.<String>read(added, "$.status")).isEqualTo("submitted");
		// Its organization and the operators read it; the public does not yet.
		assertThat(JsonPath.<List<String>>read(body(get(founder, MINE + "/" + solution).expectStatus().isOk()),
				"$.customerDeployments[*].title"))
			.containsExactly("Card enquiries");
		String queue = body(get(operator, ADMIN + "?q=Wombat").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(queue, "$.items[0].deploymentsAwaitingReview")).isEqualTo(1);
		assertThat(JsonPath.<List<Object>>read(body(client.get().uri(page).exchange().expectStatus().isOk()),
				"$.customerDeployments"))
			.isEmpty();

		String review = "/api/solution/admin/deployments/" + id;
		assertProblem(post(founder, review + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		post(operator, review + "/approve", null).expectStatus().isNoContent();
		assertProblem(post(operator, review + "/approve", null), 409, "SOLUTION_DEPLOYMENT_NOT_AWAITING_REVIEW");
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
		String other = provider("founder@bystanders.test", "Bystanders Co");
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
		request.put("listed", true);
		request.put("version", version);
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

	/** Uploads a file in the three requests of the storage module and returns the stored file. */
	private UUID uploaded(String session, String purpose, String fileName, byte[] content) {
		String ticket = body(post(session, "/api/storage/uploads", Map.of("purpose", purpose, "fileName", fileName,
				"mediaType", "application/pdf", "sizeBytes", content.length))
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

	private UUID organization(String session, String name, String role) {
		return UUID.fromString(JsonPath.read(body(post(session, ORGANIZATION + "/organizations",
				Map.of("name", name, "roles", List.of(role), "type", "company", "country", "VN", "teamSize", "2_9",
						"industries", List.of("insurance"), "website", "https://example.test", "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
	}

	private void approve(UUID organization) {
		post(operator, ORGANIZATION + "/admin/organizations/" + organization + "/approve", null).expectStatus()
			.isNoContent();
	}

	/** The session of an owner of an approved organization that provides solutions. */
	private String provider(String email, String name) {
		String session = signIn(email);
		approve(organization(session, name, "provider"));
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

	@TestConfiguration(proxyBeanMethods = false)
	static class Mail {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}

	}

}
