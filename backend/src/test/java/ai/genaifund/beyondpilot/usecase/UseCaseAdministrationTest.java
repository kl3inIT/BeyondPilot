package ai.genaifund.beyondpilot.usecase;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * What operators do with use cases, over real HTTP against PostgreSQL: who may, which organizations a use case can be
 * for, what a draft and a published use case hold, what is refused, how a use case reads once its date has passed, and
 * what the audit trail keeps. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@usecase.test")
@Import({ TestcontainersConfiguration.class, UseCaseAdministrationTest.Mail.class })
class UseCaseAdministrationTest {

	private static final String USE_CASES = "/api/usecase/admin/use-cases";

	private static final String ORGANIZATIONS = "/api/usecase/admin/organizations";

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
		operator = TestSignIn.session(client, mail, "operator@usecase.test");
	}

	@Test
	void nobodyButAnOperatorReadsOrWritesUseCases() {
		String user = TestSignIn.session(client, mail, "plain@usecase.test");
		UUID organization = organization("Guarded " + UUID.randomUUID(), "enterprise");
		String guarded = body(post(operator, USE_CASES, useCase(organization, "Guarded", false)).expectStatus()
			.isCreated());
		String one = USE_CASES + "/" + JsonPath.<String>read(guarded, "$.id");

		client.get().uri(USE_CASES).exchange().expectStatus().isUnauthorized();
		client.get().uri(one).exchange().expectStatus().isUnauthorized();
		client.get().uri(ORGANIZATIONS).exchange().expectStatus().isUnauthorized();
		post(null, USE_CASES, useCase(organization, "Nobody", false)).expectStatus().isUnauthorized();

		assertProblem(get(user, USE_CASES), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(get(user, one), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(get(user, ORGANIZATIONS), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(user, USE_CASES, useCase(organization, "Mine", false)), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertThat(titles()).doesNotContain("Nobody", "Mine");
	}

	@Test
	void anOperatorSavesADraftForAnEnterpriseAndReadsItBack() {
		UUID organization = organization("Draft Bank " + UUID.randomUUID(), "enterprise");
		Map<String, Object> draft = useCase(organization, "  Voice-enabled navigation  ", false);
		draft.put("currentSolutions", "   ");
		draft.put("technologies", List.of("voice_ai", "conversational_ai", "voice_ai"));
		draft.put("requirements", List.of(Map.of("statement", " Understand Vietnamese ", "necessity", "required"),
				Map.of("statement", "Remind owners", "necessity", "optional")));

		String created = body(post(operator, USE_CASES, draft).expectStatus()
			.isCreated()
			.expectBody()
			.jsonPath("$.title")
			.isEqualTo("Voice-enabled navigation")
			.jsonPath("$.status")
			.isEqualTo("draft")
			.jsonPath("$.publishedAt")
			.isEmpty()
			.jsonPath("$.currentSolutions")
			.isEmpty()
			.jsonPath("$.technologies")
			.isEqualTo(List.of("voice_ai", "conversational_ai"))
			.jsonPath("$.requirements[0].statement")
			.isEqualTo("Understand Vietnamese")
			.jsonPath("$.requirements[1].necessity")
			.isEqualTo("optional")
			.jsonPath("$.organization.id")
			.isEqualTo(organization.toString())
			.jsonPath("$.version")
			.isEqualTo(0)
			.jsonPath("$.createdAt")
			.isNotEmpty());
		String id = JsonPath.read(created, "$.id");

		get(operator, USE_CASES + "/" + id).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.problemStatement")
			.isEqualTo("Our service team checks documents by hand.")
			.jsonPath("$.budgetMin")
			.isEqualTo(15000)
			.jsonPath("$.budgetMax")
			.isEqualTo(40000)
			.jsonPath("$.timelineMinWeeks")
			.isEqualTo(8)
			.jsonPath("$.hideOrganizationName")
			.isEqualTo(false);
		assertThat(eventsOf(id)).singleElement()
			.satisfies(event -> assertThat(event).containsEntry("action", "use_case.create")
				.containsEntry("actor_email", "operator@usecase.test")
				.containsEntry("resource_label", "Voice-enabled navigation"));
		assertThat(detailsOf(id)).contains("\"status\": \"draft\"").contains(organization.toString());
	}

	@Test
	void publishingAtOnceNeedsNoReview() {
		UUID organization = organization("Published Bank " + UUID.randomUUID(), "enterprise");

		String created = body(post(operator, USE_CASES, useCase(organization, "Published at once", true)).expectStatus()
			.isCreated()
			.expectBody()
			.jsonPath("$.status")
			.isEqualTo("published")
			.jsonPath("$.publishedAt")
			.isNotEmpty());

		assertThat(detailsOf(JsonPath.read(created, "$.id"))).contains("\"status\": \"published\"");
	}

	@Test
	void aBudgetToBeDeterminedHasNoAmount() {
		UUID organization = organization("Budget Bank " + UUID.randomUUID(), "enterprise");
		Map<String, Object> undecided = useCase(organization, "Budget to decide", false);
		undecided.put("budgetToBeDetermined", true);
		undecided.put("budgetMin", null);
		undecided.put("budgetMax", null);

		post(operator, USE_CASES, undecided).expectStatus()
			.isCreated()
			.expectBody()
			.jsonPath("$.budgetToBeDetermined")
			.isEqualTo(true)
			.jsonPath("$.budgetMin")
			.isEmpty()
			.jsonPath("$.budgetMax")
			.isEmpty();
	}

	@Test
	void onlyAnApprovedEnterpriseCanHaveAUseCase() {
		UUID provider = organization("Provider Only " + UUID.randomUUID(), "provider");
		UUID pending = pendingEnterprise("pending-owner@usecase.test");

		assertProblem(post(operator, USE_CASES, useCase(provider, "For a provider", false)), 400,
				"USECASE_ORGANIZATION_NOT_ELIGIBLE");
		assertProblem(post(operator, USE_CASES, useCase(pending, "For a pending one", false)), 400,
				"USECASE_ORGANIZATION_NOT_ELIGIBLE");
		assertProblem(post(operator, USE_CASES, useCase(UUID.randomUUID(), "For nobody", false)), 400,
				"USECASE_ORGANIZATION_NOT_ELIGIBLE");
		assertThat(titles()).doesNotContain("For a provider", "For a pending one", "For nobody");
	}

	@Test
	void aBriefThatCannotStandIsRefused() {
		UUID organization = organization("Refusing Bank " + UUID.randomUUID(), "enterprise");

		Map<String, Object> past = useCase(organization, "Closes yesterday", false);
		past.put("closesAt", Instant.now().minus(1, ChronoUnit.DAYS).toString());
		assertProblem(post(operator, USE_CASES, past), 400, "USECASE_CLOSES_IN_THE_PAST");

		Map<String, Object> upsideDown = useCase(organization, "Budget upside down", false);
		upsideDown.put("budgetMin", 50000);
		upsideDown.put("budgetMax", 10000);
		assertProblem(post(operator, USE_CASES, upsideDown), 400, "USECASE_BUDGET_OUT_OF_ORDER");

		Map<String, Object> half = useCase(organization, "Budget half given", false);
		half.put("budgetMax", null);
		assertProblem(post(operator, USE_CASES, half), 400, "USECASE_BUDGET_INCOMPLETE");

		Map<String, Object> both = useCase(organization, "Budget both ways", false);
		both.put("budgetToBeDetermined", true);
		assertProblem(post(operator, USE_CASES, both), 400, "USECASE_BUDGET_INCOMPLETE");

		Map<String, Object> slow = useCase(organization, "Timeline upside down", false);
		slow.put("timelineMinWeeks", 12);
		slow.put("timelineMaxWeeks", 8);
		assertProblem(post(operator, USE_CASES, slow), 400, "USECASE_TIMELINE_OUT_OF_ORDER");

		Map<String, Object> unknown = useCase(organization, "Unknown industry", false);
		unknown.put("industry", "space_mining");
		post(operator, USE_CASES, unknown).expectStatus().isBadRequest();

		Map<String, Object> noRequirement = useCase(organization, "No requirement", false);
		noRequirement.put("requirements", List.of());
		post(operator, USE_CASES, noRequirement).expectStatus().isBadRequest();

		assertThat(titles()).doesNotContain("Closes yesterday", "Budget upside down", "Budget half given",
				"Budget both ways", "Timeline upside down", "Unknown industry", "No requirement");
	}

	@Test
	void aUseCaseReadsAsClosedOnceItsDateHasPassed() {
		UUID organization = organization("Closing Bank " + UUID.randomUUID(), "enterprise");
		String title = "Closing " + UUID.randomUUID();
		String created = body(post(operator, USE_CASES, useCase(organization, title, true)).expectStatus().isCreated());
		String id = JsonPath.read(created, "$.id");
		get(operator, USE_CASES + "/" + id).expectBody().jsonPath("$.status").isEqualTo("published");

		jdbc.sql("update use_case set closes_at = now() - interval '1 day' where id = ?").param(UUID.fromString(id)).update();

		get(operator, USE_CASES + "/" + id).expectBody()
			.jsonPath("$.status")
			.isEqualTo("closed")
			.jsonPath("$.publishedAt")
			.isNotEmpty();
		assertThat(titles("?status=closed&q=" + title)).containsExactly(title);
		assertThat(titles("?status=published&q=" + title)).isEmpty();
	}

	@Test
	void theListIsNewestFirstAndNarrowedByTitleAndStatus() {
		String tag = UUID.randomUUID().toString().substring(0, 8);
		String bank = "Bank" + UUID.randomUUID().toString().substring(0, 8);
		UUID organization = organization("Listed " + bank, "enterprise");
		post(operator, USE_CASES, useCase(organization, "Earlier " + tag, false)).expectStatus().isCreated();
		post(operator, USE_CASES, useCase(organization, "Later " + tag, true)).expectStatus().isCreated();

		assertThat(titles("?q=" + tag)).containsExactly("Later " + tag, "Earlier " + tag);
		assertThat(titles("?q=" + bank.toUpperCase())).containsExactly("Later " + tag, "Earlier " + tag);
		assertThat(titles("?organizationId=" + organization)).containsExactly("Later " + tag, "Earlier " + tag);
		assertThat(titles("?organizationId=" + UUID.randomUUID())).isEmpty();
		assertThat(titles("?q=" + tag.toUpperCase() + "&status=draft")).containsExactly("Earlier " + tag);
		assertThat(titles("?q=" + tag + "&status=published")).containsExactly("Later " + tag);
		String page = body(get(operator, USE_CASES + "?q=" + tag).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.total")
			.isEqualTo(2)
			.jsonPath("$.page")
			.isEqualTo(1)
			.jsonPath("$.pageSize")
			.isEqualTo(25)
			.jsonPath("$.inReview")
			.isNumber()
			.jsonPath("$.items[0].organization.id")
			.isEqualTo(organization.toString()));
		assertThat(JsonPath.<List<String>>read(page, "$.items[*].organization.name")).allSatisfy(
				name -> assertThat(name).startsWith("Listed "));
		get(operator, USE_CASES + "?status=sleeping").expectStatus().isBadRequest();
		get(operator, USE_CASES + "?page=0").expectStatus().isBadRequest();
	}

	@Test
	void theFormOffersOnlyApprovedEnterprises() {
		String tag = UUID.randomUUID().toString().substring(0, 8);
		organization("Offered Enterprise " + tag, "enterprise");
		organization("Offered Both " + tag, "provider", "enterprise");
		organization("Offered Provider " + tag, "provider");
		pendingEnterprise("pending-offer@usecase.test");

		String offered = body(get(operator, ORGANIZATIONS + "?q=" + tag.toUpperCase()).expectStatus().isOk());

		assertThat(JsonPath.<List<String>>read(offered, "$.items[*].name"))
			.containsExactly("Offered Both " + tag, "Offered Enterprise " + tag);
		assertThat(JsonPath.<List<String>>read(body(get(operator, ORGANIZATIONS).expectStatus().isOk()), "$.items[*].name"))
			.doesNotContain("Offered Provider " + tag);
	}

	@Test
	void anAttachmentIsAFileTheOperatorUploadedForAUseCaseAndBelongsToOne() {
		UUID organization = organization("Files Bank " + UUID.randomUUID(), "enterprise");
		UUID mine = file("operator@usecase.test", "use_case_attachment", "stored");
		Map<String, Object> withFile = useCase(organization, "With a file", false);
		withFile.put("attachmentFileIds", List.of(mine));

		post(operator, USE_CASES, withFile).expectStatus()
			.isCreated()
			.expectBody()
			.jsonPath("$.attachments[0].id")
			.isEqualTo(mine.toString())
			.jsonPath("$.attachments[0].fileName")
			.isEqualTo("samples.pdf")
			.jsonPath("$.attachments[0].sizeBytes")
			.isEqualTo(2048);

		Map<String, Object> again = useCase(organization, "Same file again", false);
		again.put("attachmentFileIds", List.of(mine));
		assertProblem(post(operator, USE_CASES, again), 400, "USECASE_ATTACHMENT_NOT_USABLE");

		TestSignIn.session(client, mail, "plain-files@usecase.test");
		for (UUID notUsable : List.of(file("plain-files@usecase.test", "use_case_attachment", "stored"),
				file("operator@usecase.test", "use_case_attachment", "pending"),
				file("operator@usecase.test", "application_file", "stored"), UUID.randomUUID())) {
			Map<String, Object> refused = useCase(organization, "Refused file", false);
			refused.put("attachmentFileIds", List.of(notUsable));
			assertProblem(post(operator, USE_CASES, refused), 400, "USECASE_ATTACHMENT_NOT_USABLE");
		}
		UUID twice = file("operator@usecase.test", "use_case_attachment", "stored");
		Map<String, Object> doubled = useCase(organization, "Listed twice", false);
		doubled.put("attachmentFileIds", List.of(twice, twice));
		assertProblem(post(operator, USE_CASES, doubled), 400, "USECASE_ATTACHMENT_NOT_USABLE");
		assertThat(titles()).doesNotContain("Same file again", "Refused file", "Listed twice");
	}

	/** The record of a file as storage keeps it; a use case reads the record, never the bytes. */
	private UUID file(String uploader, String purpose, String status) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, ?, false, 'samples.pdf', 'application/pdf', 2048, ?, id, now()
				from identity_account where email = ?
				""").params(id, "test/" + id, purpose, status, uploader).update();
		return id;
	}

	private UUID organization(String name, String... roles) {
		return UUID.fromString(JsonPath.read(body(post(operator, "/api/organization/admin/organizations",
				Map.of("name", name, "roles", List.of(roles), "type", "company"))
			.expectStatus()
			.isCreated()), "$.organization.id"));
	}

	/** An enterprise a person created and nobody has approved yet. */
	private UUID pendingEnterprise(String email) {
		String owner = TestSignIn.session(client, mail, email);
		return UUID.fromString(JsonPath.read(body(post(owner, "/api/organization/organizations",
				Map.of("name", "Pending " + UUID.randomUUID(), "roles", List.of("enterprise"), "type", "company",
						"country", "VN", "teamSize", "2_9", "industries", List.of("insurance"), "website",
						"https://example.test", "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
	}

	/** The brief of a use case, complete and valid. */
	private static Map<String, Object> useCase(UUID organization, String title, boolean publishNow) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("organizationId", organization);
		body.put("title", title);
		body.put("problemStatement", "Our service team checks documents by hand.");
		body.put("industry", "automotive_mobility");
		body.put("technologies", List.of("voice_ai"));
		body.put("expectedOutcomes", "Cut hotline calls by 40%.");
		body.put("currentProcess", "Agents type dates into a spreadsheet.");
		body.put("currentSolutions", "A basic OCR tool.");
		body.put("targetUsers", "Vehicle owners and the service team.");
		body.put("requirements", List.of(Map.of("statement", "Read documents", "necessity", "required")));
		body.put("dataReadiness", "Scanned documents with labelled fields.");
		body.put("integrationRequirements", "App SDK and the document store API.");
		body.put("attachmentFileIds", List.of());
		body.put("budgetMin", 15000);
		body.put("budgetMax", 40000);
		body.put("budgetToBeDetermined", false);
		body.put("budgetMembersOnly", false);
		body.put("timelineMinWeeks", 8);
		body.put("timelineMaxWeeks", 12);
		body.put("closesAt", Instant.now().plus(60, ChronoUnit.DAYS).toString());
		body.put("hideOrganizationName", false);
		body.put("publishNow", publishNow);
		return body;
	}

	private RestTestClient.ResponseSpec post(String session, String uri, Map<String, Object> body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON);
		if (session != null) {
			request = request.cookie(TestSignIn.SESSION_COOKIE, session);
		}
		return request.body(body).exchange();
	}

	private RestTestClient.ResponseSpec get(String session, String uri) {
		return client.get().uri(uri).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private List<String> titles() {
		return titles("");
	}

	private List<String> titles(String query) {
		return JsonPath.read(body(get(operator, USE_CASES + query).expectStatus().isOk()), "$.items[*].title");
	}

	private List<Map<String, Object>> eventsOf(String useCase) {
		return jdbc.sql("""
				select action, actor_email, resource_label
				from audit_event where resource_type = 'use_case' and resource_id = ? order by occurred_at, id
				""").param(useCase).query().listOfRows();
	}

	private String detailsOf(String useCase) {
		return jdbc.sql("select details::text from audit_event where resource_type = 'use_case' and resource_id = ?")
			.param(useCase)
			.query(String.class)
			.single();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	private static String body(RestTestClient.BodyContentSpec content) {
		return new String(content.returnResult().getResponseBody(), UTF_8);
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
