package ai.genaifund.beyondpilot.organization;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Organizations over real HTTP against PostgreSQL: how a person gets into one, what owners and members may do inside,
 * and what operators review. Only the SMTP server is replaced. Each test uses its own email domain, because a verified
 * domain belongs to one organization.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, OrganizationTest.Mail.class })
class OrganizationTest {

	private static final String API = "/api/organization";

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
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = signIn("operator@genaifund.test");
	}

	@Test
	void aCreatedOrganizationWaitsForReviewAndItsCreatorOwnsIt() {
		String founder = signIn("founder@created.test");

		String created = body(post(founder, API + "/organizations", creation("Created Co")).expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(created, "$.status")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(created, "$.slug")).isEqualTo("created-co");
		// A work address vouches for nothing: an operator verifies the domain.
		assertThat(JsonPath.<String>read(created, "$.emailDomain")).isNull();
		assertThat(JsonPath.<Boolean>read(created, "$.autoJoin")).isFalse();
		assertThat(JsonPath.<List<String>>read(created, "$.industries")).containsExactly("insurance",
				"banking_finance");
		String mine = mine(founder);
		assertThat(JsonPath.<String>read(mine, "$.role")).isEqualTo("owner");
		assertThat(JsonPath.<String>read(mine, "$.jobTitle")).isEqualTo("Founder");
		assertThat(JsonPath.<String>read(mine, "$.organization.name")).isEqualTo("Created Co");
		// A person belongs to one organization.
		assertProblem(post(founder, API + "/organizations", creation("Second Co")), 409,
				"ORGANIZATION_ALREADY_MEMBER");
	}

	@Test
	void anOrganizationOfTheSameNameGetsItsOwnAddress() {
		String first = body(post(signIn("someone.one@gmail.com"), API + "/organizations",
				creation("Same Name"))
			.expectStatus()
			.isCreated());
		String second = body(post(signIn("someone.two@gmail.com"), API + "/organizations",
				creation("Same Name"))
			.expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(first, "$.slug")).isEqualTo("same-name");
		assertThat(JsonPath.<String>read(second, "$.slug")).isEqualTo("same-name-2");
	}

	@Test
	void aRequestOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		String body = body(post(signIn("typo@invalid.test"), API + "/organizations",
				Map.of("name", " ", "type", "club", "country", "vn", "industries",
						List.of("mining"), "website", "x"))
			.expectStatus()
			.isBadRequest());

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/name",
				"#/type", "#/country", "#/teamSize", "#/industries/0", "#/website", "#/description",
				"#/foundedYear");
	}

	@Test
	void aTeamOrABuilderOnTheirOwnMayNameNoIndustryButACompanyNamesOne() {
		Map<String, Object> builder = new HashMap<>(creation("Dat Phan"));
		builder.put("type", "independent_builder");
		builder.put("teamSize", "just_me");
		builder.put("industries", List.of());
		String created = body(post(signIn("dat@builder.test"), API + "/organizations", builder).expectStatus()
			.isCreated());
		assertThat(JsonPath.<String>read(created, "$.type")).isEqualTo("independent_builder");
		assertThat(JsonPath.<String>read(created, "$.status")).isEqualTo("in_review");

		Map<String, Object> company = new HashMap<>(creation("No Industry Co"));
		company.put("industries", List.of());
		assertProblem(post(signIn("founder@no-industry.test"), API + "/organizations", company), 400,
				"ORGANIZATION_INDUSTRIES_REQUIRED");
	}

	@Test
	void aCreationNeedsItsWebsiteDescriptionAndYearButNotTheCreatorsJobTitle() {
		String session = signIn("facts@invalid.test");
		String path = API + "/organizations";
		// Each is refused on its own: a missing website, a description over 280 characters and a year out of range.
		for (Map.Entry<String, Object> broken : Map.<String, Object>of("website", " ", "description", "x".repeat(281),
				"foundedYear", 1799)
			.entrySet()) {
			Map<String, Object> request = new HashMap<>(creation("Facts Co"));
			request.put(broken.getKey(), broken.getValue());
			String problem = body(post(session, path, request).expectStatus().isBadRequest());
			assertThat(JsonPath.<List<String>>read(problem, "$.errors[*].pointer")).contains("#/" + broken.getKey());
		}

		Map<String, Object> request = new HashMap<>(creation("Facts Co"));
		request.remove("jobTitle");
		String created = body(post(session, path, request).expectStatus().isCreated());

		assertThat(JsonPath.<Integer>read(created, "$.foundedYear")).isEqualTo(2021);
		assertThat(JsonPath.<String>read(created, "$.description")).isEqualTo("Assistants for insurers.");
		assertThat(JsonPath.<String>read(mine(session), "$.jobTitle")).isNull();
	}

	@Test
	void aLogoIsAnUploadedImageThatOnlyOneOrganizationNamesAndIsRemovedWhenReplaced() {
		String founder = signIn("founder@logo.test");
		UUID first = uploadedLogo(founder);
		Map<String, Object> request = new HashMap<>(creation("Logo Co"));
		request.put("logoFileId", first.toString());

		String created = body(post(founder, API + "/organizations", request).expectStatus().isCreated());

		assertThat(JsonPath.<String>read(created, "$.logoFileId")).isEqualTo(first.toString());
		// Another organization cannot name the same file, nor a file that was never uploaded as a logo.
		Map<String, Object> other = new HashMap<>(creation("Other Logo Co"));
		other.put("logoFileId", first.toString());
		assertProblem(post(signIn("other@logo.test"), API + "/organizations", other), 400,
				"ORGANIZATION_LOGO_NOT_USABLE");
		other.put("logoFileId", UUID.randomUUID().toString());
		assertProblem(post(signIn("other@logo.test"), API + "/organizations", other), 400,
				"ORGANIZATION_LOGO_NOT_USABLE");

		// Saving another logo gives the first one up; saving none gives up the second.
		UUID second = uploadedLogo(founder);
		Map<String, Object> replaced = save(profile("Logo Co"), versionOf(mine(founder)));
		replaced.put("logoFileId", second.toString());
		put(founder, API + "/mine", replaced).expectStatus().isOk();
		assertThat(stored(first)).isFalse();
		assertThat(stored(second)).isTrue();
		Map<String, Object> removed = save(profile("Logo Co"), versionOf(mine(founder)));
		removed.put("logoFileId", null);
		put(founder, API + "/mine", removed).expectStatus().isOk();
		assertThat(stored(second)).isFalse();
		assertThat(JsonPath.<Object>read(mine(founder), "$.organization.logoFileId")).isNull();
	}

	@Test
	void anOperatorApprovesAnOrganizationWithItsDomainAndItsOwnerIsTold() {
		String founder = signIn("founder@approved.test");
		UUID id = create(founder, "Approved Co");
		String approval = API + "/admin/organizations/" + id + "/approve";

		assertProblem(post(founder, approval, Map.of()), 403, "IDENTITY_OPERATOR_REQUIRED");
		// The creator's work domain is proposed, for the operator to confirm.
		assertThat(JsonPath.<String>read(body(get(operator, API + "/admin/organizations/" + id).expectStatus().isOk()),
				"$.suggestedDomain"))
			.isEqualTo("approved.test");
		post(operator, approval, Map.of("emailDomain", "approved.test")).expectStatus().isNoContent();

		String mine = mine(founder);
		assertThat(JsonPath.<String>read(mine, "$.organization.status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(mine, "$.organization.emailDomain")).isEqualTo("approved.test");
		assertThat(mail.latestSubjectTo("founder@approved.test")).isEqualTo("Approved Co on BeyondPilot");
		assertThat(events(id)).containsExactly("organization.approve");
		// A decision is made once.
		assertProblem(post(operator, approval, Map.of()), 409, "ORGANIZATION_NOT_AWAITING_REVIEW");
	}

	@Test
	void aDomainAnotherOrganizationHasIsNotVerifiedTwice() {
		approved(signIn("founder@taken.test"), "Taken Co", "taken.test");
		String second = signIn("second@taken.test");
		UUID id = create(second, "Taken Twice");

		assertThat(JsonPath.<Object>read(body(get(operator, API + "/admin/organizations/" + id).expectStatus().isOk()),
				"$.suggestedDomain"))
			.isNull();
		assertProblem(post(operator, API + "/admin/organizations/" + id + "/approve",
				Map.of("emailDomain", "taken.test")), 409, "ORGANIZATION_DOMAIN_TAKEN");
		assertProblem(post(operator, API + "/admin/organizations/" + id + "/approve",
				Map.of("emailDomain", "Not A Domain")), 400, "REQUEST_INVALID");

		// Nothing was decided.
		assertThat(JsonPath.<String>read(mine(second), "$.organization.status")).isEqualTo("in_review");
	}

	@Test
	void anOrganizationSentBackShowsWhyAndWaitsAgainOnceItsOwnerSavesIt() {
		String founder = signIn("founder@sentback.test");
		UUID id = create(founder, "Sent Back Co");
		String sendBack = API + "/admin/organizations/" + id + "/send-back";

		assertProblem(post(founder, sendBack, Map.of("reason", "Tell us what you build.")), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(operator, sendBack, Map.of("reason", " ")), 400, "REQUEST_INVALID");
		post(operator, sendBack, Map.of("reason", "Tell us what you build.")).expectStatus().isNoContent();
		assertThat(mail.latestSubjectTo("founder@sentback.test")).isEqualTo("Changes needed: Sent Back Co");
		// It no longer waits for review, so it is not decided twice.
		assertProblem(post(operator, sendBack, Map.of("reason", "Again.")), 409, "ORGANIZATION_NOT_AWAITING_REVIEW");
		assertProblem(post(operator, API + "/admin/organizations/" + id + "/approve", Map.of()), 409,
				"ORGANIZATION_NOT_AWAITING_REVIEW");

		String sentBack = mine(founder);
		assertThat(JsonPath.<String>read(sentBack, "$.organization.status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<Object>read(sentBack, "$.organization.decisionReason")).isNull();
		assertThat(JsonPath.<String>read(sentBack, "$.organization.decisionMessage"))
			.isEqualTo("Tell us what you build.");
		assertThat(events(id)).containsExactly("organization.send_back");

		Map<String, Object> corrected = save(profile("Sent Back Co"),
				JsonPath.<Integer>read(sentBack, "$.organization.version"));
		put(founder, API + "/mine", corrected).expectStatus().isOk();
		assertThat(JsonPath.<String>read(mine(founder), "$.organization.status")).isEqualTo("in_review");
		// The screen that read the older version is told, instead of overwriting.
		assertProblem(put(founder, API + "/mine", corrected), 409, "ORGANIZATION_CHANGED_MEANWHILE");
	}

	@Test
	void aRefusedOrganizationIsRefusedForGoodAndOnlyWhileItWaitsForReview() {
		String founder = signIn("founder@refused.test");
		UUID id = create(founder, "Refused Co");
		String refuse = API + "/admin/organizations/" + id + "/refuse";

		// Missing information is a send back, not a refusal.
		assertProblem(post(operator, refuse, Map.of("reason", "incomplete")), 400, "REQUEST_INVALID");
		post(operator, refuse, Map.of("reason", "not_a_real_organization", "message", "We found no such company."))
			.expectStatus()
			.isNoContent();
		assertProblem(post(operator, refuse, Map.of("reason", "duplicate")), 409, "ORGANIZATION_NOT_AWAITING_REVIEW");

		String refused = mine(founder);
		assertThat(JsonPath.<String>read(refused, "$.organization.status")).isEqualTo("rejected");
		assertThat(JsonPath.<String>read(refused, "$.organization.decisionReason")).isEqualTo("not_a_real_organization");
		assertThat(JsonPath.<String>read(refused, "$.organization.decisionMessage"))
			.isEqualTo("We found no such company.");
		assertThat(events(id)).containsExactly("organization.refuse");

		// Its owner may still correct the profile, but it is not reviewed again.
		put(founder, API + "/mine",
				save(profile("Refused Co"), JsonPath.<Integer>read(refused, "$.organization.version")))
			.expectStatus()
			.isOk();
		assertThat(JsonPath.<String>read(mine(founder), "$.organization.status")).isEqualTo("rejected");
	}

	@Test
	void theMembersAreReadOnePageAtATimeOwnersFirstWithAllInvitationsAndTheTotal() {
		String founder = signIn("founder@paging.test");
		UUID id = create(founder, "Paging Co");
		post(operator, API + "/admin/organizations/" + id + "/approve", Map.of("emailDomain", "paging.test"))
			.expectStatus()
			.isNoContent();
		put(founder, API + "/mine/auto-join", Map.of("autoJoin", true)).expectStatus().isNoContent();
		for (int person = 1; person <= 11; person++) {
			String joiner = signIn("person" + person + "@paging.test");
			assertThat(outcome(post(joiner, API + "/organizations/" + id + "/join", Map.of()))).isEqualTo("joined");
		}
		post(founder, API + "/mine/invitations", Map.of("email", "invited@elsewhere.test", "role", "member"))
			.expectStatus()
			.isNoContent();

		String first = members(founder);
		assertThat(JsonPath.<Integer>read(first, "$.page")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(first, "$.pageSize")).isEqualTo(10);
		assertThat(JsonPath.<Integer>read(first, "$.total")).isEqualTo(12);
		assertThat(JsonPath.<List<Object>>read(first, "$.members")).hasSize(10);
		assertThat(JsonPath.<String>read(first, "$.members[0].role")).isEqualTo("owner");
		String second = members(founder, 2);
		assertThat(JsonPath.<Integer>read(second, "$.page")).isEqualTo(2);
		assertThat(JsonPath.<List<Object>>read(second, "$.members")).hasSize(2);
		// Invitations are not paged: the owner reads every open one on any page.
		assertThat(JsonPath.<List<Object>>read(second, "$.invitations")).hasSize(1);
		assertThat(JsonPath.<List<Object>>read(members(founder, 3), "$.members")).isEmpty();
		assertProblem(get(founder, API + "/mine/members?page=0"), 400, "REQUEST_INVALID");
	}

	@Test
	void anAddressOnTheVerifiedDomainJoinsAtOnceOnlyWhileItsOwnersAllowIt() {
		String founder = signIn("founder@domain.test");
		UUID id = create(founder, "Domain Co");
		// Joining at once needs an approved organization with a verified domain.
		assertProblem(put(founder, API + "/mine/auto-join", Map.of("autoJoin", true)), 409,
				"ORGANIZATION_DOMAIN_NOT_VERIFIED");
		post(operator, API + "/admin/organizations/" + id + "/approve", Map.of("emailDomain", "domain.test"))
			.expectStatus()
			.isNoContent();
		String colleague = signIn("colleague@domain.test");

		// It is off until an owner turns it on.
		assertThat(JsonPath.<String>read(mine(colleague), "$.suggestion.way")).isEqualTo("request");
		assertProblem(put(colleague, API + "/mine/auto-join", Map.of("autoJoin", true)), 403,
				"ORGANIZATION_MEMBERSHIP_REQUIRED");
		put(founder, API + "/mine/auto-join", Map.of("autoJoin", true)).expectStatus().isNoContent();
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
		String waiting = mine(later);
		assertThat(JsonPath.<String>read(waiting, "$.request.organizationName")).isEqualTo("Domain Co");
		assertThat(JsonPath.<String>read(waiting, "$.request.organizationDomain")).isEqualTo("domain.test");
		assertThat(JsonPath.<Boolean>read(waiting, "$.request.claim")).isFalse();
		assertProblem(post(later, API + "/organizations/" + id + "/join", Map.of()), 409,
				"ORGANIZATION_REQUEST_PENDING");

		// A member reads who belongs, and none of what only owners decide.
		String forMember = members(colleague);
		assertThat(JsonPath.<List<Object>>read(forMember, "$.requests")).isEmpty();
		assertThat(JsonPath.<Object>read(forMember, "$.allowance")).isNull();
		String forOwner = members(founder);
		assertThat(JsonPath.<String>read(forOwner, "$.requests[0].message")).isEqualTo("I work here");
		String request = JsonPath.read(forOwner, "$.requests[0].id");
		assertProblem(post(colleague, API + "/mine/requests/" + request + "/approve", null), 403,
				"ORGANIZATION_OWNER_REQUIRED");
		post(founder, API + "/mine/requests/" + request + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<List<String>>read(members(founder), "$.members[*].email"))
			.containsExactly("founder@domain.test", "colleague@domain.test", "later@domain.test");
		assertThat(mail.latestSubjectTo("later@domain.test")).isEqualTo("Your request for Domain Co on BeyondPilot");
	}

	@Test
	void aDeclinedRequestIsShownUntilThePersonAsksAgain() {
		String founder = signIn("founder@declining.test");
		UUID id = approved(founder, "Declining Co");
		String outsider = signIn("outsider@declined.test");
		post(outsider, API + "/organizations/" + id + "/join", Map.of()).expectStatus().isOk();
		assertThat(JsonPath.<Object>read(mine(outsider), "$.declined")).isNull();

		String request = JsonPath.read(members(founder), "$.requests[0].id");
		post(founder, API + "/mine/requests/" + request + "/decline", null).expectStatus().isNoContent();

		String declined = mine(outsider);
		assertThat(JsonPath.<Object>read(declined, "$.request")).isNull();
		assertThat(JsonPath.<String>read(declined, "$.declined.organizationName")).isEqualTo("Declining Co");
		assertThat(JsonPath.<String>read(declined, "$.declined.organizationId")).isEqualTo(id.toString());
		assertThat(JsonPath.<Boolean>read(declined, "$.declined.claim")).isFalse();
		assertThat(mail.latestSubjectTo("outsider@declined.test"))
			.isEqualTo("Your request for Declining Co on BeyondPilot");

		// Asking again replaces the answer, and so does withdrawing what was asked.
		post(outsider, API + "/organizations/" + id + "/join", Map.of()).expectStatus().isOk();
		assertThat(JsonPath.<Object>read(mine(outsider), "$.declined")).isNull();
		post(outsider, API + "/join-request/withdraw", null).expectStatus().isNoContent();
		String free = mine(outsider);
		assertThat(JsonPath.<Object>read(free, "$.request")).isNull();
		assertThat(JsonPath.<Object>read(free, "$.declined")).isNull();
	}

	@Test
	void anAddressElsewhereAsksAndMayWithdraw() {
		UUID id = approved(signIn("founder@asked.test"), "Asked Co");
		String outsider = signIn("outsider@elsewhere.test");

		assertThat(JsonPath.<String>read(
				body(get(outsider, API + "/organizations?q=asked").expectStatus().isOk()), "$.items[0].way"))
			.isEqualTo("request");
		assertThat(outcome(post(outsider, API + "/organizations/" + id + "/join", Map.of()))).isEqualTo("requested");
		assertProblem(post(outsider, API + "/organizations", creation("Elsewhere")), 409,
				"ORGANIZATION_REQUEST_PENDING");

		post(outsider, API + "/join-request/withdraw", null).expectStatus().isNoContent();

		assertThat(JsonPath.<Object>read(mine(outsider), "$.request")).isNull();
		post(outsider, API + "/organizations", creation("Elsewhere")).expectStatus().isCreated();
	}

	@Test
	void anOperatorEditsTheProfileAndTheDomainAndManagesThePeopleOfAnyOrganization() {
		String founder = signIn("founder@managed.test");
		UUID id = approved(founder, "Managed Co");
		String colleague = signIn("colleague@managed.test");
		String detail = API + "/admin/organizations/" + id;
		post(operator, detail + "/invitations", Map.of("email", "colleague@managed.test", "role", "member"))
			.expectStatus()
			.isNoContent();
		post(colleague, API + "/invitations/"
				+ JsonPath.<String>read(body(get(operator, detail).expectStatus().isOk()), "$.invitations[0].id")
				+ "/accept", Map.of())
			.expectStatus()
			.isNoContent();

		// The profile and the domain, saved against the version the screen read.
		int version = JsonPath.<Integer>read(body(get(operator, detail).expectStatus().isOk()), "$.organization.version");
		Map<String, Object> edit = Map.of("profile", save(profile("Managed Company"), version), "emailDomain",
				"managed.test");
		assertProblem(put(founder, detail, edit), 403, "IDENTITY_OPERATOR_REQUIRED");
		String saved = body(put(operator, detail, edit).expectStatus().isOk());
		assertThat(JsonPath.<String>read(saved, "$.organization.name")).isEqualTo("Managed Company");
		assertThat(JsonPath.<String>read(saved, "$.organization.emailDomain")).isEqualTo("managed.test");
		assertProblem(put(operator, detail, edit), 409, "ORGANIZATION_CHANGED_MEANWHILE");
		UUID other = approved(signIn("other@other-managed.test"), "Other Managed Co");
		assertProblem(put(operator, API + "/admin/organizations/" + other,
				Map.of("profile", save(profile("Other Managed Co"),
						JsonPath.<Integer>read(body(get(operator, API + "/admin/organizations/" + other)
							.expectStatus()
							.isOk()), "$.organization.version")),
						"emailDomain", "managed.test")),
				409, "ORGANIZATION_DOMAIN_TAKEN");
		put(founder, API + "/mine/auto-join", Map.of("autoJoin", true)).expectStatus().isNoContent();
		Map<String, Object> withoutDomain = new HashMap<>();
		withoutDomain.put("profile", save(profile("Managed Company"),
				JsonPath.<Integer>read(body(get(operator, detail).expectStatus().isOk()), "$.organization.version")));
		withoutDomain.put("emailDomain", null);
		String cleared = body(put(operator, detail, withoutDomain).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(cleared, "$.organization.emailDomain")).isNull();
		// With no domain nobody joins at once any more.
		assertThat(JsonPath.<Boolean>read(cleared, "$.organization.autoJoin")).isFalse();

		// The people: a role changes, and an operator may leave the organization without an owner.
		String colleagueId = JsonPath.<List<String>>read(cleared, "$.members[?(@.email == 'colleague@managed.test')].accountId").get(0);
		String founderId = JsonPath.<List<String>>read(cleared, "$.members[?(@.email == 'founder@managed.test')].accountId").get(0);
		put(operator, detail + "/members/" + colleagueId + "/role", Map.of("role", "owner")).expectStatus().isNoContent();
		post(operator, detail + "/members/" + founderId + "/remove", null).expectStatus().isNoContent();
		post(operator, detail + "/members/" + colleagueId + "/remove", null).expectStatus().isNoContent();
		assertThat(JsonPath.<List<Object>>read(body(get(operator, detail).expectStatus().isOk()), "$.members")).isEmpty();
		assertProblem(post(operator, detail + "/members/" + colleagueId + "/remove", null), 404,
				"ORGANIZATION_MEMBER_NOT_FOUND");

		// An invitation by an operator is not counted against the organization, and is taken back by one.
		post(operator, detail + "/invitations", Map.of("email", "new@managed.test", "role", "owner"))
			.expectStatus()
			.isNoContent();
		assertProblem(post(operator, detail + "/invitations", Map.of("email", "new@managed.test", "role", "owner")),
				409, "ORGANIZATION_ALREADY_INVITED");
		String invitation = JsonPath.<String>read(body(get(operator, detail).expectStatus().isOk()),
				"$.invitations[0].id");
		post(operator, detail + "/invitations/" + invitation + "/revoke", null).expectStatus().isNoContent();
		assertProblem(post(operator, detail + "/invitations/" + invitation + "/revoke", null), 404,
				"ORGANIZATION_INVITATION_NOT_FOUND");
		assertThat(events(id)).contains("organization.update", "organization.member_role",
				"organization.member_remove", "organization.invite", "organization.invitation_revoke");
	}

	@Test
	void anOperatorTakesAnApprovedOrganizationDownWithAReasonAndRestoresItKeepingTheMembersWorkspace() {
		String founder = signIn("founder@takedown.test");
		UUID id = approved(founder, "Takedown Co");
		String takeDown = API + "/admin/organizations/" + id + "/take-down";

		assertProblem(post(founder, takeDown, Map.of("reason", "other")), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(operator, takeDown, Map.of("reason", "not-a-reason")), 400, "REQUEST_INVALID");
		assertProblem(post(operator, API + "/admin/organizations/" + UUID.randomUUID() + "/take-down",
				Map.of("reason", "other")), 404, "ORGANIZATION_NOT_FOUND");
		assertProblem(post(operator, API + "/admin/organizations/" + id + "/restore", null), 409,
				"ORGANIZATION_NOT_TAKEN_DOWN");

		post(operator, takeDown, Map.of("reason", "misleading_information", "message", "Send us the contract."))
			.expectStatus()
			.isNoContent();
		assertThat(mail.latestSubjectTo("founder@takedown.test")).isEqualTo("Takedown Co on BeyondPilot");
		assertProblem(post(operator, takeDown, Map.of("reason", "other")), 409, "ORGANIZATION_CANNOT_TAKE_DOWN");

		// Its review stays approved; its members keep the workspace and read why; it is in no directory and invites
		// nobody.
		String mine = mine(founder);
		assertThat(JsonPath.<String>read(mine, "$.organization.status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(mine, "$.organization.suspendedAt")).isNotNull();
		assertThat(JsonPath.<String>read(mine, "$.organization.suspensionReason")).isEqualTo("misleading_information");
		assertThat(JsonPath.<String>read(mine, "$.organization.suspensionMessage")).isEqualTo("Send us the contract.");
		assertThat(JsonPath.<String>read(mine, "$.role")).isEqualTo("owner");
		assertThat(JsonPath.<List<Object>>read(
				body(get(signIn("visitor@takedown.test"), API + "/organizations?q=takedown").expectStatus().isOk()),
				"$.items"))
			.isEmpty();
		assertProblem(get(signIn("visitor@takedown.test"), API + "/organizations/takedown-co"), 404,
				"ORGANIZATION_NOT_FOUND");
		assertProblem(post(founder, API + "/mine/invitations", Map.of("email", "new@takedown.test", "role", "member")),
				409, "ORGANIZATION_NOT_APPROVED");
		String suspended = body(get(operator, API + "/admin/organizations?status=suspended").expectStatus().isOk());
		assertThat(JsonPath.<String>read(suspended, "$.items[0].id")).isEqualTo(id.toString());
		assertThat(JsonPath.<String>read(suspended, "$.items[0].status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(suspended, "$.items[0].suspendedAt")).isNotNull();
		assertThat(JsonPath.<List<Object>>read(
				body(get(operator, API + "/admin/organizations?q=takedown&status=approved").expectStatus().isOk()),
				"$.items"))
			.isEmpty();

		post(operator, API + "/admin/organizations/" + id + "/restore", null).expectStatus().isNoContent();
		assertThat(JsonPath.<String>read(mine(founder), "$.organization.status")).isEqualTo("approved");
		assertThat(JsonPath.<Object>read(mine(founder), "$.organization.suspendedAt")).isNull();
		// What was said when it was taken down stays on the record.
		assertThat(JsonPath.<String>read(mine(founder), "$.organization.suspensionReason"))
			.isEqualTo("misleading_information");
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
		String forOwner = members(founder);
		assertThat(JsonPath.<List<String>>read(forOwner, "$.invitations[*].email")).containsExactly("Guest@gmail.com");
		assertThat(JsonPath.<Boolean>read(forOwner, "$.allowance.open")).isTrue();
		assertThat(JsonPath.<Integer>read(forOwner, "$.allowance.leftToday")).isEqualTo(19);
		assertThat(JsonPath.<Integer>read(forOwner, "$.allowance.leftOpen")).isEqualTo(49);

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
	void onlyAnApprovedOrganizationInvitesAndNoMoreThanItsDailyLimit() {
		String founder = signIn("founder@limited.test");
		UUID id = create(founder, "Limited Co");
		assertProblem(post(founder, API + "/mine/invitations", Map.of("email", "early@gmail.com", "role", "member")),
				409, "ORGANIZATION_NOT_APPROVED");
		assertThat(JsonPath.<Boolean>read(members(founder), "$.allowance.open")).isFalse();
		post(operator, API + "/admin/organizations/" + id + "/approve", Map.of()).expectStatus().isNoContent();

		for (int sent = 1; sent <= 20; sent++) {
			post(founder, API + "/mine/invitations", Map.of("email", "guest" + sent + "@gmail.com", "role", "member"))
				.expectStatus()
				.isNoContent();
		}

		Map<String, Object> oneMore = Map.of("email", "guest21@gmail.com", "role", "member");
		assertProblem(post(founder, API + "/mine/invitations", oneMore), 429, "ORGANIZATION_INVITATION_DAILY_LIMIT");
		// Taking an invitation back does not give the day's count back.
		String sent = members(founder);
		assertThat(JsonPath.<Integer>read(sent, "$.allowance.leftToday")).isZero();
		post(founder, API + "/mine/invitations/" + JsonPath.<String>read(sent, "$.invitations[0].id") + "/revoke", null)
			.expectStatus()
			.isNoContent();
		assertProblem(post(founder, API + "/mine/invitations", oneMore), 429, "ORGANIZATION_INVITATION_DAILY_LIMIT");
	}

	@Test
	void anOrganizationKeepsNoMoreOpenInvitationsThanItsLimit() {
		String founder = signIn("founder@open-limit.test");
		UUID id = approved(founder, "Open Limit Co");
		UUID founderId = idOf("founder@open-limit.test");
		for (int open = 1; open <= 50; open++) {
			jdbc.sql("""
					insert into organization_invitation (id, organization_id, email, role, invited_by_account_id, created_at)
					values (?, ?, ?, 'member', ?, now() - interval '2 days')
					""").params(UUID.randomUUID(), id, "waiting" + open + "@gmail.com", founderId).update();
		}

		String full = members(founder);
		assertThat(JsonPath.<Integer>read(full, "$.allowance.leftToday")).isEqualTo(20);
		assertThat(JsonPath.<Integer>read(full, "$.allowance.leftOpen")).isZero();
		Map<String, Object> oneMore = Map.of("email", "waiting51@gmail.com", "role", "member");
		assertProblem(post(founder, API + "/mine/invitations", oneMore), 429, "ORGANIZATION_INVITATION_OPEN_LIMIT");

		// An invitation taken back makes room for another.
		post(founder, API + "/mine/invitations/" + JsonPath.<String>read(full, "$.invitations[0].id") + "/revoke", null)
			.expectStatus()
			.isNoContent();
		post(founder, API + "/mine/invitations", oneMore).expectStatus().isNoContent();
	}

	@Test
	void anOrganizationKeepsAnOwnerAndAMemberOnlyTakesThemselvesOut() {
		String founder = signIn("founder@owners.test");
		UUID id = approved(founder, "Owners Co", "owners.test");
		put(founder, API + "/mine/auto-join", Map.of("autoJoin", true)).expectStatus().isNoContent();
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
				Map.of("name", "Handed Over", "type", "company", "emailDomain",
						"handed.test", "ownerEmail", "chief@handed.test"))
			.expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(created, "$.organization.status")).isEqualTo("approved");
		assertThat(JsonPath.<List<Object>>read(created, "$.members")).isEmpty();
		assertThat(JsonPath.<String>read(created, "$.invitations[0].role")).isEqualTo("owner");
		assertThat(mail.latestSubjectTo("chief@handed.test"))
			.isEqualTo("You are invited to Handed Over on BeyondPilot");
		assertProblem(post(operator, API + "/admin/organizations",
				Map.of("name", "Handed Twice", "type", "company", "emailDomain",
						"handed.test")),
				409, "ORGANIZATION_DOMAIN_TAKEN");

		String chief = signIn("chief@handed.test");
		String invitation = JsonPath.read(mine(chief), "$.invitations[0].id");
		post(chief, API + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();

		String mine = mine(chief);
		assertThat(JsonPath.<String>read(mine, "$.role")).isEqualTo("owner");
		// What GenAI Fund sent does not count against what the organization may send.
		assertThat(JsonPath.<Integer>read(members(chief), "$.allowance.leftToday")).isEqualTo(20);
	}

	@Test
	void anOperatorMayFillInTheWholeProfileWhenCreatingAnOrganization() {
		UUID logo = uploadedLogo(operator);
		String created = body(post(operator, API + "/admin/organizations",
				Map.of("name", "Fully Described", "type", "builder_team", "website", "https://fully-described.test",
						"country", "VN", "teamSize", "10_49", "industries", List.of("logistics", "insurance"),
						"description", "Routes parcels for small shops.", "foundedYear", 2019, "logoFileId",
						logo.toString()))
			.expectStatus()
			.isCreated());

		assertThat(JsonPath.<String>read(created, "$.organization.teamSize")).isEqualTo("10_49");
		assertThat(JsonPath.<List<String>>read(created, "$.organization.industries"))
			.containsExactly("logistics", "insurance");
		assertThat(JsonPath.<String>read(created, "$.organization.description"))
			.isEqualTo("Routes parcels for small shops.");
		assertThat(JsonPath.<Integer>read(created, "$.organization.foundedYear")).isEqualTo(2019);
		assertThat(JsonPath.<String>read(created, "$.organization.logoFileId")).isEqualTo(logo.toString());
		// Anyone reads the logo on the organization's public page.
		String publicPage = body(get(signIn("reader@logo.test"), API + "/organizations/fully-described").expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(publicPage, "$.logoFileId")).isEqualTo(logo.toString());
		assertProblem(post(operator, API + "/admin/organizations",
				Map.of("name", "Too Many", "type", "company", "industries",
						List.of("logistics", "insurance", "retail_ecommerce", "healthcare", "manufacturing",
								"banking_finance"))),
				400, "REQUEST_INVALID");
	}

	@Test
	void anOrganizationNobodyOwnsIsClaimedEvenFromItsDomainAndAnOperatorDecides() {
		String unowned = JsonPath.read(body(post(operator, API + "/admin/organizations",
				Map.of("name", "Unowned One", "type", "company", "emailDomain",
						"unowned-one.test"))
			.expectStatus()
			.isCreated()), "$.organization.id");

		// An address on the domain proves nothing about acting for the company.
		String insider = signIn("first@unowned-one.test");
		assertThat(JsonPath.<String>read(mine(insider), "$.suggestion.way")).isEqualTo("claim");
		assertThat(outcome(post(insider, API + "/organizations/" + unowned + "/join", Map.of("message", "I run it"))))
			.isEqualTo("requested");
		assertThat(JsonPath.<Boolean>read(mine(insider), "$.request.claim")).isTrue();

		String waiting = body(
				get(operator, API + "/admin/organizations?q=unowned one&status=in_review").expectStatus().isOk());
		assertThat(JsonPath.<String>read(waiting, "$.items[0].request")).isEqualTo("claim");
		assertThat(JsonPath.<String>read(waiting, "$.items[0].status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(waiting, "$.items[0].askedBy")).isEqualTo("first@unowned-one.test");
		String claim = JsonPath.read(waiting, "$.items[0].claimId");
		String review = body(get(operator, API + "/admin/organizations/" + unowned).expectStatus().isOk());
		assertThat(JsonPath.<String>read(review, "$.claims[0].id")).isEqualTo(claim);
		assertThat(JsonPath.<String>read(review, "$.claims[0].email")).isEqualTo("first@unowned-one.test");
		assertProblem(post(insider, API + "/admin/claims/" + claim + "/approve", Map.of()), 403,
				"IDENTITY_OPERATOR_REQUIRED");

		post(operator, API + "/admin/claims/" + claim + "/decline", null).expectStatus().isNoContent();

		String declined = mine(insider);
		assertThat(JsonPath.<String>read(declined, "$.declined.organizationName")).isEqualTo("Unowned One");
		assertThat(JsonPath.<Boolean>read(declined, "$.declined.claim")).isTrue();
		assertThat(mail.latestSubjectTo("first@unowned-one.test"))
			.isEqualTo("Your request for Unowned One on BeyondPilot");
		assertThat(JsonPath.<Object>read(
				body(get(operator, API + "/admin/organizations?q=unowned one").expectStatus().isOk()),
				"$.items[0].request"))
			.isNull();
	}

	@Test
	void anApprovedClaimMakesItsOwnerAndVerifiesTheDomain() {
		approved(signIn("founder@claimed-taken.test"), "Claimed Taken", "claimed-taken.test");
		String unowned = JsonPath.read(body(post(operator, API + "/admin/organizations",
				Map.of("name", "Claimed Co", "type", "company", "website",
						"https://www.claimed.test/about"))
			.expectStatus()
			.isCreated()), "$.organization.id");
		String claimant = signIn("claimant@gmail.com");
		String second = signIn("second@gmail.com");
		assertThat(JsonPath.<String>read(
				body(get(claimant, API + "/organizations?q=claimed co").expectStatus().isOk()), "$.items[0].way"))
			.isEqualTo("claim");
		post(claimant, API + "/organizations/" + unowned + "/join", Map.of()).expectStatus().isOk();
		post(second, API + "/organizations/" + unowned + "/join", Map.of()).expectStatus().isOk();

		String review = body(get(operator, API + "/admin/organizations/" + unowned).expectStatus().isOk());
		// Its website's domain is proposed, for the operator to confirm.
		assertThat(JsonPath.<String>read(review, "$.suggestedDomain")).isEqualTo("claimed.test");
		String claim = JsonPath.read(review, "$.claims[0].id");
		assertProblem(post(operator, API + "/admin/claims/" + claim + "/approve",
				Map.of("emailDomain", "claimed-taken.test")), 409, "ORGANIZATION_DOMAIN_TAKEN");
		post(operator, API + "/admin/claims/" + claim + "/approve", Map.of("emailDomain", "claimed.test"))
			.expectStatus()
			.isNoContent();

		String mine = mine(claimant);
		assertThat(JsonPath.<String>read(mine, "$.role")).isEqualTo("owner");
		assertThat(JsonPath.<String>read(mine, "$.organization.emailDomain")).isEqualTo("claimed.test");
		assertThat(mail.latestSubjectTo("claimant@gmail.com")).isEqualTo("Your request for Claimed Co on BeyondPilot");
		assertThat(events(UUID.fromString(unowned))).containsExactly("organization.create",
				"organization.claim_approve");
		assertProblem(post(operator, API + "/admin/claims/" + claim + "/decline", null), 404,
				"ORGANIZATION_REQUEST_NOT_FOUND");
		// The other claim is now a request its owner decides.
		String forOwner = members(claimant);
		assertThat(JsonPath.<String>read(forOwner, "$.requests[0].email")).isEqualTo("second@gmail.com");
		assertThat(JsonPath.<Boolean>read(forOwner, "$.requests[0].claim")).isFalse();
		String request = JsonPath.read(forOwner, "$.requests[0].id");
		assertProblem(post(operator, API + "/admin/claims/" + request + "/approve", Map.of()), 404,
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
		assertThat(JsonPath.<String>read(all, "$.items[0].request")).isEqualTo("new");
		assertThat(JsonPath.<String>read(all, "$.items[0].askedBy")).isEqualTo("founder@listed-wait.test");
		assertThat(JsonPath.<Object>read(all, "$.items[1].request")).isNull();
		assertThat(JsonPath.<Object>read(all, "$.items[1].askedBy")).isNull();
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

	private static Map<String, Object> profile(String name) {
		return Map.of("name", name, "type", "company", "country", "VN", "teamSize", "2_9",
				"industries", List.of("insurance", "banking_finance"), "website", "https://example.test", "description",
				"Assistants for insurers.", "foundedYear", 2021);
	}

	/** A profile with what only its creation asks: what the creator does there. */
	private static Map<String, Object> creation(String name) {
		Map<String, Object> request = new HashMap<>(profile(name));
		request.put("jobTitle", " Founder ");
		return request;
	}

	private static Map<String, Object> save(Map<String, Object> profile, int version) {
		Map<String, Object> request = new HashMap<>(profile);
		request.put("version", version);
		return request;
	}

	private UUID create(String session, String name) {
		return UUID.fromString(JsonPath.read(
				body(post(session, API + "/organizations", creation(name)).expectStatus().isCreated()),
				"$.id"));
	}

	private UUID approved(String session, String name) {
		UUID id = create(session, name);
		post(operator, API + "/admin/organizations/" + id + "/approve", Map.of()).expectStatus().isNoContent();
		return id;
	}

	/** An approved organization whose email domain the operator verified. */
	private UUID approved(String session, String name, String domain) {
		UUID id = create(session, name);
		post(operator, API + "/admin/organizations/" + id + "/approve", Map.of("emailDomain", domain)).expectStatus()
			.isNoContent();
		return id;
	}

	private String mine(String session) {
		return body(get(session, API + "/mine").expectStatus().isOk());
	}

	private static int versionOf(String mine) {
		return JsonPath.<Integer>read(mine, "$.organization.version");
	}

	/** Uploads a PNG as an organization logo, in the three requests of the storage module. */
	private UUID uploadedLogo(String session) {
		byte[] content = new byte[64];
		byte[] signature = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };
		System.arraycopy(signature, 0, content, 0, signature.length);
		String ticket = body(post(session, "/api/storage/uploads", Map.of("purpose", "organization_logo", "fileName",
				"logo.png", "mediaType", "image/png", "sizeBytes", content.length))
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

	private String members(String session) {
		return body(get(session, API + "/mine/members").expectStatus().isOk());
	}

	private String members(String session, int page) {
		return body(get(session, API + "/mine/members?page=" + page).expectStatus().isOk());
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

	/**
	 * The test mailbox, imported through a class of this test's own so that the test keeps a Spring context, and with
	 * it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
