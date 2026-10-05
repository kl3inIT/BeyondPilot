package ai.genaifund.beyondpilot.organization;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Organizations over real HTTP against PostgreSQL: how a person gets into one, what owners and members may do inside,
 * and what operators review. Only the SMTP server is replaced. Each test uses its own email domain, because a domain
 * belongs to one organization.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, OrganizationTest.Mail.class })
class OrganizationTest {

	private static final String API = "/api/organization";

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
	void aCreatedOrganizationWaitsForReviewAndItsCreatorOwnsIt() {
		String founder = signIn("founder@created.test");

		String created = body(post(founder, API + "/organizations", profile("Created Co", "provider")).expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(created, "$.status")).isEqualTo("pending");
		assertThat(JsonPath.<String>read(created, "$.slug")).isEqualTo("created-co");
		assertThat(JsonPath.<String>read(created, "$.emailDomain")).isEqualTo("created.test");
		assertThat(JsonPath.<List<String>>read(created, "$.roles")).containsExactly("provider");
		String mine = mine(founder);
		assertThat(JsonPath.<String>read(mine, "$.role")).isEqualTo("owner");
		assertThat(JsonPath.<String>read(mine, "$.organization.name")).isEqualTo("Created Co");
		// A person belongs to one organization.
		assertProblem(post(founder, API + "/organizations", profile("Second Co", "provider")), 409,
				"ORGANIZATION_ALREADY_MEMBER");
	}

	@Test
	void aPublicMailAddressVouchesForNoDomainAndTheSameNameGetsItsOwnAddress() {
		String first = body(post(signIn("someone.one@gmail.com"), API + "/organizations",
				profile("Same Name", "provider", "enterprise"))
			.expectStatus()
			.isCreated());
		String second = body(post(signIn("someone.two@gmail.com"), API + "/organizations",
				profile("Same Name", "enterprise", "provider"))
			.expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(first, "$.emailDomain")).isNull();
		assertThat(JsonPath.<String>read(first, "$.slug")).isEqualTo("same-name");
		assertThat(JsonPath.<String>read(second, "$.slug")).isEqualTo("same-name-2");
		// The roles read the same whatever order they were sent in.
		assertThat(JsonPath.<List<String>>read(second, "$.roles")).containsExactly("provider", "enterprise");
	}

	@Test
	void aRequestOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		String body = body(post(signIn("typo@invalid.test"), API + "/organizations",
				Map.of("name", " ", "roles", List.of("investor"), "type", "club", "country", "vn", "website", "x"))
			.expectStatus()
			.isBadRequest());

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/name",
				"#/roles/0", "#/type", "#/country", "#/website");
	}

	@Test
	void anOperatorApprovesAnOrganizationAndItsOwnerIsTold() {
		String founder = signIn("founder@approved.test");
		UUID id = create(founder, "Approved Co");

		assertProblem(post(founder, API + "/admin/organizations/" + id + "/approve", null), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		post(operator, API + "/admin/organizations/" + id + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<String>read(mine(founder), "$.organization.status")).isEqualTo("approved");
		assertThat(mail.latestSubjectTo("founder@approved.test")).isEqualTo("Approved Co on BeyondPilot");
		assertThat(events(id)).containsExactly("organization.approve");
		// A decision is made once.
		assertProblem(post(operator, API + "/admin/organizations/" + id + "/approve", null), 409,
				"ORGANIZATION_NOT_AWAITING_REVIEW");
	}

	@Test
	void aRefusedOrganizationShowsWhyAndWaitsAgainOnceItsOwnerSavesIt() {
		String founder = signIn("founder@refused.test");
		UUID id = create(founder, "Refused Co");

		post(operator, API + "/admin/organizations/" + id + "/refuse",
				Map.of("reason", "incomplete", "message", "Tell us what you build."))
			.expectStatus()
			.isNoContent();

		String refused = mine(founder);
		assertThat(JsonPath.<String>read(refused, "$.organization.status")).isEqualTo("rejected");
		assertThat(JsonPath.<String>read(refused, "$.organization.decisionReason")).isEqualTo("incomplete");
		assertThat(JsonPath.<String>read(refused, "$.organization.decisionMessage"))
			.isEqualTo("Tell us what you build.");
		assertThat(events(id)).containsExactly("organization.refuse");

		Map<String, Object> corrected = save(profile("Refused Co", "provider"),
				JsonPath.<Integer>read(refused, "$.organization.version"));
		put(founder, API + "/mine", corrected).expectStatus().isOk();
		assertThat(JsonPath.<String>read(mine(founder), "$.organization.status")).isEqualTo("pending");
		// The screen that read the older version is told, instead of overwriting.
		assertProblem(put(founder, API + "/mine", corrected), 409, "ORGANIZATION_CHANGED_MEANWHILE");
	}

	@Test
	void anAddressOnTheDomainJoinsAtOnceUntilItsOwnersSwitchThatOff() {
		String founder = signIn("founder@domain.test");
		UUID id = approved(founder, "Domain Co");
		String colleague = signIn("colleague@domain.test");

		assertThat(JsonPath.<String>read(mine(colleague), "$.suggestion.way")).isEqualTo("join");
		assertThat(outcome(post(colleague, API + "/organizations/" + id + "/join", Map.of()))).isEqualTo("joined");
		assertThat(JsonPath.<String>read(mine(colleague), "$.role")).isEqualTo("member");

		assertProblem(put(colleague, API + "/mine/auto-join", Map.of("autoJoin", false)), 403,
				"ORGANIZATION_OWNER_REQUIRED");
		put(founder, API + "/mine/auto-join", Map.of("autoJoin", false)).expectStatus().isNoContent();
		String later = signIn("later@domain.test");
		assertThat(JsonPath.<String>read(mine(later), "$.suggestion.way")).isEqualTo("request");
		assertThat(outcome(post(later, API + "/organizations/" + id + "/join", Map.of("message", "I work here"))))
			.isEqualTo("requested");
		assertThat(JsonPath.<String>read(mine(later), "$.request.organizationName")).isEqualTo("Domain Co");
		assertProblem(post(later, API + "/organizations/" + id + "/join", Map.of()), 409,
				"ORGANIZATION_REQUEST_PENDING");

		// A member reads who belongs, and none of what only owners decide.
		assertThat(JsonPath.<List<Object>>read(members(colleague), "$.requests")).isEmpty();
		String forOwner = members(founder);
		assertThat(JsonPath.<String>read(forOwner, "$.requests[0].message")).isEqualTo("I work here");
		String request = JsonPath.read(forOwner, "$.requests[0].id");
		assertProblem(post(colleague, API + "/mine/requests/" + request + "/approve", null), 403,
				"ORGANIZATION_OWNER_REQUIRED");
		post(founder, API + "/mine/requests/" + request + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<List<String>>read(members(founder), "$.members[*].email"))
			.containsExactly("founder@domain.test", "colleague@domain.test", "later@domain.test");
	}

	@Test
	void anAddressElsewhereAsksAndMayWithdraw() {
		UUID id = approved(signIn("founder@asked.test"), "Asked Co");
		String outsider = signIn("outsider@elsewhere.test");

		assertThat(JsonPath.<String>read(
				body(get(outsider, API + "/organizations?q=asked").expectStatus().isOk()), "$.items[0].way"))
			.isEqualTo("request");
		assertThat(outcome(post(outsider, API + "/organizations/" + id + "/join", Map.of()))).isEqualTo("requested");
		assertProblem(post(outsider, API + "/organizations", profile("Elsewhere", "provider")), 409,
				"ORGANIZATION_REQUEST_PENDING");

		post(outsider, API + "/join-request/withdraw", null).expectStatus().isNoContent();

		assertThat(JsonPath.<Object>read(mine(outsider), "$.request")).isNull();
		post(outsider, API + "/organizations", profile("Elsewhere", "provider")).expectStatus().isCreated();
	}

	@Test
	void anOrganizationThatIsNotApprovedIsNeitherFoundNorJoined() {
		UUID id = create(signIn("founder@waiting.test"), "Waiting Co");
		String colleague = signIn("colleague@waiting.test");

		assertThat(JsonPath.<Object>read(mine(colleague), "$.suggestion")).isNull();
		assertThat(JsonPath.<List<Object>>read(
				body(get(colleague, API + "/organizations?q=waiting").expectStatus().isOk()), "$.items"))
			.isEmpty();
		assertProblem(post(colleague, API + "/organizations/" + id + "/join", Map.of()), 404,
				"ORGANIZATION_NOT_FOUND");
	}

	@Test
	void anOwnerInvitesAnAddressWhichAcceptsAfterSigningIn() {
		String founder = signIn("founder@inviting.test");
		approved(founder, "Inviting Co");

		post(founder, API + "/mine/invitations", Map.of("email", "Guest@gmail.com", "role", "member")).expectStatus()
			.isNoContent();

		assertThat(mail.latestSubjectTo("Guest@gmail.com")).isEqualTo("You are invited to Inviting Co on BeyondPilot");
		assertProblem(post(founder, API + "/mine/invitations", Map.of("email", "guest@gmail.com", "role", "owner")),
				409, "ORGANIZATION_ALREADY_INVITED");
		assertProblem(
				post(founder, API + "/mine/invitations", Map.of("email", "FOUNDER@inviting.test", "role", "member")),
				409, "ORGANIZATION_INVITEE_IS_MEMBER");
		assertThat(JsonPath.<List<String>>read(members(founder), "$.invitations[*].email"))
			.containsExactly("Guest@gmail.com");

		String guest = signIn("guest@gmail.com");
		String invited = mine(guest);
		assertThat(JsonPath.<String>read(invited, "$.invitations[0].organizationName")).isEqualTo("Inviting Co");
		assertThat(JsonPath.<String>read(invited, "$.invitations[0].invitedBy")).isEqualTo("founder@inviting.test");
		String invitation = JsonPath.read(invited, "$.invitations[0].id");
		// An invitation is its address's: another person cannot use its identifier.
		assertProblem(post(signIn("stranger@gmail.com"), API + "/invitations/" + invitation + "/accept", null), 404,
				"ORGANIZATION_INVITATION_NOT_FOUND");

		post(guest, API + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();

		assertThat(JsonPath.<String>read(mine(guest), "$.role")).isEqualTo("member");
		assertProblem(post(guest, API + "/invitations/" + invitation + "/accept", null), 404,
				"ORGANIZATION_INVITATION_NOT_FOUND");
		assertProblem(post(guest, API + "/mine/invitations", Map.of("email", "friend@gmail.com", "role", "member")),
				403, "ORGANIZATION_OWNER_REQUIRED");
	}

	@Test
	void anInvitationIsDeclinedOrTakenBack() {
		String founder = signIn("founder@closing.test");
		approved(founder, "Closing Co");
		post(founder, API + "/mine/invitations", Map.of("email", "declines@gmail.com", "role", "member"))
			.expectStatus()
			.isNoContent();
		post(founder, API + "/mine/invitations", Map.of("email", "revoked@gmail.com", "role", "member"))
			.expectStatus()
			.isNoContent();
		String declines = signIn("declines@gmail.com");
		String revoked = signIn("revoked@gmail.com");
		String toDecline = JsonPath.read(mine(declines), "$.invitations[0].id");
		String toRevoke = JsonPath.read(mine(revoked), "$.invitations[0].id");

		post(declines, API + "/invitations/" + toDecline + "/decline", null).expectStatus().isNoContent();
		post(founder, API + "/mine/invitations/" + toRevoke + "/revoke", null).expectStatus().isNoContent();

		assertThat(JsonPath.<List<Object>>read(mine(declines), "$.invitations")).isEmpty();
		assertProblem(post(revoked, API + "/invitations/" + toRevoke + "/accept", null), 404,
				"ORGANIZATION_INVITATION_NOT_FOUND");
		assertThat(JsonPath.<List<Object>>read(members(founder), "$.invitations")).isEmpty();
	}

	@Test
	void anOrganizationKeepsAnOwnerAndAMemberOnlyTakesThemselvesOut() {
		String founder = signIn("founder@owners.test");
		UUID id = approved(founder, "Owners Co");
		String colleague = signIn("colleague@owners.test");
		post(colleague, API + "/organizations/" + id + "/join", Map.of()).expectStatus().isOk();
		UUID founderId = idOf("founder@owners.test");
		UUID colleagueId = idOf("colleague@owners.test");

		assertProblem(put(founder, API + "/mine/members/" + founderId + "/role", Map.of("role", "member")), 409,
				"ORGANIZATION_LAST_OWNER");
		assertProblem(post(founder, API + "/mine/members/" + founderId + "/remove", null), 409,
				"ORGANIZATION_LAST_OWNER");
		assertProblem(post(colleague, API + "/mine/members/" + founderId + "/remove", null), 403,
				"ORGANIZATION_OWNER_REQUIRED");
		assertProblem(put(colleague, API + "/mine/members/" + colleagueId + "/role", Map.of("role", "owner")), 403,
				"ORGANIZATION_OWNER_REQUIRED");

		put(founder, API + "/mine/members/" + colleagueId + "/role", Map.of("role", "owner")).expectStatus()
			.isNoContent();
		put(colleague, API + "/mine/job-title", Map.of("jobTitle", " Head of Sales ")).expectStatus().isNoContent();
		// With a second owner the first may leave.
		post(founder, API + "/mine/members/" + founderId + "/remove", null).expectStatus().isNoContent();

		assertThat(JsonPath.<Object>read(mine(founder), "$.organization")).isNull();
		String remaining = members(colleague);
		assertThat(JsonPath.<List<String>>read(remaining, "$.members[*].role")).containsExactly("owner");
		assertThat(JsonPath.<String>read(remaining, "$.members[0].jobTitle")).isEqualTo("Head of Sales");
		assertThat(JsonPath.<Boolean>read(remaining, "$.members[0].self")).isTrue();
		assertThat(events(id)).containsExactly("organization.approve", "organization.member_role",
				"organization.member_remove");
		assertProblem(post(colleague, API + "/mine/members/" + UUID.randomUUID() + "/remove", null), 404,
				"ORGANIZATION_MEMBER_NOT_FOUND");
	}

	@Test
	void anOperatorCreatesAnOrganizationAndTheInvitedPersonOwnsIt() {
		String created = body(post(operator, API + "/admin/organizations",
				Map.of("name", "Handed Over", "roles", List.of("enterprise"), "type", "company", "emailDomain",
						"handed.test", "ownerEmail", "chief@handed.test"))
			.expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(created, "$.organization.status")).isEqualTo("approved");
		assertThat(JsonPath.<List<Object>>read(created, "$.members")).isEmpty();
		assertThat(JsonPath.<String>read(created, "$.invitations[0].role")).isEqualTo("owner");
		assertThat(mail.latestSubjectTo("chief@handed.test"))
			.isEqualTo("You are invited to Handed Over on BeyondPilot");
		assertProblem(post(operator, API + "/admin/organizations",
				Map.of("name", "Handed Twice", "roles", List.of("enterprise"), "type", "company", "emailDomain",
						"handed.test")),
				409, "ORGANIZATION_DOMAIN_TAKEN");

		String chief = signIn("chief@handed.test");
		String invitation = JsonPath.read(mine(chief), "$.invitations[0].id");
		post(chief, API + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();

		String mine = mine(chief);
		assertThat(JsonPath.<String>read(mine, "$.role")).isEqualTo("owner");
		assertThat(JsonPath.<List<String>>read(mine, "$.organization.roles")).containsExactly("enterprise");
	}

	@Test
	void anOrganizationNobodyOwnsIsOwnedAtOnceFromItsDomainAndClaimedFromElsewhere() {
		String fromDomain = JsonPath.read(body(post(operator, API + "/admin/organizations",
				Map.of("name", "Unowned One", "roles", List.of("enterprise"), "type", "company", "emailDomain",
						"unowned-one.test"))
			.expectStatus()
			.isCreated()), "$.organization.id");
		String fromElsewhere = JsonPath.read(body(post(operator, API + "/admin/organizations",
				Map.of("name", "Unowned Two", "roles", List.of("enterprise"), "type", "company"))
			.expectStatus()
			.isCreated()), "$.organization.id");

		String insider = signIn("first@unowned-one.test");
		assertThat(outcome(post(insider, API + "/organizations/" + fromDomain + "/join", Map.of()))).isEqualTo("owner");
		assertThat(JsonPath.<String>read(mine(insider), "$.role")).isEqualTo("owner");

		String claimant = signIn("claimant@gmail.com");
		assertThat(JsonPath.<String>read(
				body(get(claimant, API + "/organizations?q=unowned two").expectStatus().isOk()), "$.items[0].way"))
			.isEqualTo("claim");
		assertThat(outcome(post(claimant, API + "/organizations/" + fromElsewhere + "/join",
				Map.of("message", "I run it"))))
			.isEqualTo("requested");
		assertThat(JsonPath.<Boolean>read(mine(claimant), "$.request.claim")).isTrue();

		String review = body(get(operator, API + "/admin/organizations/" + fromElsewhere).expectStatus().isOk());
		assertThat(JsonPath.<String>read(review, "$.claims[0].email")).isEqualTo("claimant@gmail.com");
		String claim = JsonPath.read(review, "$.claims[0].id");
		assertProblem(post(claimant, API + "/admin/claims/" + claim + "/approve", null), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		post(operator, API + "/admin/claims/" + claim + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<String>read(mine(claimant), "$.role")).isEqualTo("owner");
		assertThat(events(UUID.fromString(fromElsewhere))).containsExactly("organization.create",
				"organization.claim_approve");
		assertProblem(post(operator, API + "/admin/claims/" + claim + "/decline", null), 404,
				"ORGANIZATION_REQUEST_NOT_FOUND");
	}

	@Test
	void theOperatorsListPutsThoseWaitingFirstAndIsNarrowedBySearchAndStatus() {
		approved(signIn("founder@listed-done.test"), "Listed Done");
		create(signIn("founder@listed-wait.test"), "Listed Waiting");

		assertProblem(get(signIn("plain@gmail.com"), API + "/admin/organizations"), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		String all = body(get(operator, API + "/admin/organizations?q=listed").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(all, "$.items[*].name")).containsExactly("Listed Waiting",
				"Listed Done");
		assertThat(JsonPath.<Integer>read(all, "$.total")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(all, "$.items[0].members")).isEqualTo(1);
		assertThat(JsonPath.<Boolean>read(all, "$.items[0].owned")).isTrue();
		assertThat(JsonPath.<List<String>>read(
				body(get(operator, API + "/admin/organizations?q=listed&status=approved").expectStatus().isOk()),
				"$.items[*].name"))
			.containsExactly("Listed Done");
		assertProblem(get(operator, API + "/admin/organizations/" + UUID.randomUUID()), 404,
				"ORGANIZATION_NOT_FOUND");
	}

	@Test
	void nobodySignedInReachesOrganizations() {
		client.get().uri(API + "/mine").exchange().expectStatus().isUnauthorized();
		client.get().uri(API + "/admin/organizations").exchange().expectStatus().isUnauthorized();
		assertProblem(get(signIn("nobody@gmail.com"), API + "/mine/members"), 403,
				"ORGANIZATION_MEMBERSHIP_REQUIRED");
	}

	private static Map<String, Object> profile(String name, String... roles) {
		return Map.of("name", name, "roles", List.of(roles), "type", "company", "country", "VN", "teamSize", "2_9",
				"website", "https://example.test");
	}

	private static Map<String, Object> save(Map<String, Object> profile, int version) {
		Map<String, Object> request = new HashMap<>(profile);
		request.put("version", version);
		return request;
	}

	private UUID create(String session, String name) {
		return UUID.fromString(JsonPath.read(
				body(post(session, API + "/organizations", profile(name, "provider")).expectStatus().isCreated()),
				"$.id"));
	}

	private UUID approved(String session, String name) {
		UUID id = create(session, name);
		post(operator, API + "/admin/organizations/" + id + "/approve", null).expectStatus().isNoContent();
		return id;
	}

	private String mine(String session) {
		return body(get(session, API + "/mine").expectStatus().isOk());
	}

	private String members(String session) {
		return body(get(session, API + "/mine/members").expectStatus().isOk());
	}

	private static String outcome(RestTestClient.ResponseSpec response) {
		return JsonPath.read(body(response.expectStatus().isOk()), "$.outcome");
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

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	private String signIn(String email) {
		return TestSignIn.session(client, mail, email);
	}

	private UUID idOf(String email) {
		return jdbc.sql("select id from identity_account where lower(email) = lower(?)")
			.param(email)
			.query(UUID.class)
			.single();
	}

	private List<String> events(UUID organization) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'organization' and resource_id = ?
				order by occurred_at, id
				""").param(organization.toString()).query(String.class).list();
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
