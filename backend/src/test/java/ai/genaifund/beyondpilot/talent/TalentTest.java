package ai.genaifund.beyondpilot.talent;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
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
 * Talent profiles over real HTTP against PostgreSQL: the one profile a person keeps, what a submission needs, what
 * operators decide, what the public directory shows and how a message reaches a person. Only the SMTP server is
 * replaced. Each test uses its own word in the names it searches for, because the tests share one database.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, TalentTest.Mail.class })
class TalentTest {

	private static final String MINE = "/api/talent/mine";

	private static final String ADMIN = "/api/talent/admin/profiles";

	private static final String DIRECTORY = "/api/talent/profiles";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private TalentEnquiryClock clock;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = signIn("operator@genaifund.test");
	}

	@Test
	void aPersonHasOneProfileAndALaterSaveNeedsItsVersion() {
		String person = signIn("one@profile.test");
		assertThat(JsonPath.<Object>read(mine(person), "$.profile")).isNull();

		String created = body(put(person, MINE, described("  Một Người  ", null)).expectStatus().isOk());

		assertThat(JsonPath.<String>read(created, "$.name")).isEqualTo("Một Người");
		assertThat(JsonPath.<String>read(created, "$.slug")).isEqualTo("mot-nguoi");
		assertThat(JsonPath.<String>read(created, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<List<String>>read(created, "$.projects[*].title")).containsExactly("Claims triage");
		// A second first save is a stale screen, not a second profile.
		assertProblem(put(person, MINE, described("Another Person", null)), 409, "TALENT_CHANGED_MEANWHILE");
		Map<String, Object> change = described("Một Người", versionOf(created));
		change.put("headline", "Builds document AI");
		change.put("projects", List.of());
		String saved = body(put(person, MINE, change).expectStatus().isOk());

		assertThat(versionOf(saved)).isGreaterThan(versionOf(created));
		assertThat(JsonPath.<String>read(saved, "$.id")).isEqualTo(JsonPath.<String>read(created, "$.id"));
		assertProblem(put(person, MINE, described("Overwritten", versionOf(created))), 409, "TALENT_CHANGED_MEANWHILE");
		String now = mine(person);
		assertThat(JsonPath.<String>read(now, "$.profile.headline")).isEqualTo("Builds document AI");
		assertThat(JsonPath.<List<Object>>read(now, "$.profile.projects")).isEmpty();
	}

	@Test
	void aSaveOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		Map<String, Object> request = described("Out Of Bounds", null);
		request.put("roles", List.of("wizard"));
		request.put("country", "vn");
		request.put("website", "example.test");
		request.put("projects", List.of(Map.of("title", " ")));

		String body = body(put(signIn("bounds@profile.test"), MINE, request).expectStatus().isBadRequest());

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/roles/0",
				"#/country", "#/website", "#/projects/0/title");
	}

	@Test
	void aSubmissionNeedsAHeadlineABioARoleAndASkill() {
		String person = signIn("sender@profile.test");
		assertProblem(post(person, MINE + "/submit", null), 404, "TALENT_PROFILE_NOT_FOUND");
		Map<String, Object> bare = described("Bare Profile", null);
		bare.put("headline", null);
		bare.put("skills", List.of());
		String draft = body(put(person, MINE, bare).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(draft, "$.complete")).isFalse();
		assertProblem(post(person, MINE + "/submit", null), 400, "TALENT_INCOMPLETE");

		put(person, MINE, described("Bare Profile", versionOf(draft))).expectStatus().isOk();
		String submitted = body(post(person, MINE + "/submit", null).expectStatus().isOk());

		assertThat(JsonPath.<String>read(submitted, "$.status")).isEqualTo("in_review");
		assertProblem(post(person, MINE + "/submit", null), 409, "TALENT_NOT_SUBMITTABLE");
		// What operators review keeps what a submission needs.
		bare.put("version", versionOf(submitted));
		assertProblem(put(person, MINE, bare), 400, "TALENT_INCOMPLETE");
	}

	@Test
	void anOperatorSendsAProfileBackWithAReasonAndApprovesWhatIsSentAgain() {
		String person = signIn("reviewed@profile.test");
		UUID id = submitted(person, "Reviewed Person");
		String drafter = signIn("drafter@profile.test");
		UUID draft = UUID.fromString(
				JsonPath.read(body(put(drafter, MINE, described("Unsent Person", null)).expectStatus().isOk()), "$.id"));

		assertProblem(post(person, ADMIN + "/" + id + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		// Operators see what was sent to them, never a draft.
		assertProblem(get(operator, ADMIN + "/" + draft), 404, "TALENT_PROFILE_NOT_FOUND");
		String forOperator = body(get(operator, ADMIN + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(forOperator, "$.email")).isEqualTo("reviewed@profile.test");
		assertThat(JsonPath.<String>read(forOperator, "$.profile.status")).isEqualTo("in_review");
		assertProblem(post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "boring")), 400,
				"REQUEST_INVALID");
		// Taking down is for a profile that is public, not one that waits.
		assertProblem(post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "other")), 409,
				"TALENT_NOT_APPROVED");
		post(operator, ADMIN + "/" + id + "/send-back",
				Map.of("reason", "incomplete", "message", "Say what you built."))
			.expectStatus()
			.isNoContent();

		String returned = mine(person);
		assertThat(JsonPath.<String>read(returned, "$.profile.status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(returned, "$.profile.decisionReason")).isEqualTo("incomplete");
		assertThat(JsonPath.<String>read(returned, "$.profile.decisionMessage")).isEqualTo("Say what you built.");
		assertThat(mail.latestSubjectTo("reviewed@profile.test"))
			.isEqualTo("Changes asked for your BeyondPilot talent profile");
		assertThat(mail.latestTextTo("reviewed@profile.test")).contains("Say what you built.");
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "TALENT_NOT_AWAITING_REVIEW");

		post(person, MINE + "/submit", null).expectStatus().isOk();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<String>read(mine(person), "$.profile.status")).isEqualTo("approved");
		assertThat(mail.latestSubjectTo("reviewed@profile.test")).isEqualTo("Your BeyondPilot talent profile is approved");
		assertThat(events(id)).containsExactly("talent.request_changes", "talent.approve");
		// A decision is made once.
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "TALENT_NOT_AWAITING_REVIEW");
	}

	@Test
	void anOperatorTakesAnApprovedProfileDownAndRestoresIt() {
		String person = signIn("removed@profile.test");
		UUID id = approved(person, "Removed Person");
		client.get().uri(DIRECTORY + "/removed-person").exchange().expectStatus().isOk();
		assertProblem(post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "other")), 409,
				"TALENT_NOT_AWAITING_REVIEW");
		assertProblem(post(operator, ADMIN + "/" + id + "/restore", null), 409, "TALENT_NOT_TAKEN_DOWN");
		assertProblem(post(person, ADMIN + "/" + id + "/take-down", Map.of("reason", "other")), 403,
				"IDENTITY_OPERATOR_REQUIRED");

		post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "inappropriate", "message", "Not you."))
			.expectStatus()
			.isNoContent();

		assertProblem(client.get().uri(DIRECTORY + "/removed-person").exchange(), 404, "TALENT_PROFILE_NOT_FOUND");
		String down = mine(person);
		// The review stays approved; the takedown is a flag beside it.
		assertThat(JsonPath.<String>read(down, "$.profile.status")).isEqualTo("approved");
		assertThat(JsonPath.<String>read(down, "$.profile.suspendedAt")).isNotNull();
		assertThat(JsonPath.<String>read(down, "$.profile.suspensionReason")).isEqualTo("inappropriate");
		assertThat(JsonPath.<String>read(down, "$.profile.suspensionMessage")).isEqualTo("Not you.");
		assertThat(mail.latestSubjectTo("removed@profile.test"))
			.isEqualTo("Your BeyondPilot talent profile was taken down");
		assertProblem(post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "other")), 409,
				"TALENT_NOT_APPROVED");
		assertThat(listed("suspended")).contains(id.toString());
		assertThat(listed("approved")).doesNotContain(id.toString());

		post(operator, ADMIN + "/" + id + "/restore", null).expectStatus().isNoContent();

		client.get().uri(DIRECTORY + "/removed-person").exchange().expectStatus().isOk();
		assertThat(JsonPath.<String>read(mine(person), "$.profile.suspendedAt")).isNull();
		assertThat(mail.latestSubjectTo("removed@profile.test")).isEqualTo("Your BeyondPilot talent profile is back");
		assertThat(listed("approved")).contains(id.toString());
		assertThat(events(id)).containsExactly("talent.approve", "talent.remove", "talent.restore");
	}

	@Test
	void aProfileTakenDownIsCorrectedAndSentAgainAndItsApprovalLiftsTheTakedown() {
		String person = signIn("corrected@profile.test");
		UUID id = approved(person, "Corrected Person");
		assertProblem(post(person, MINE + "/submit", null), 409, "TALENT_NOT_SUBMITTABLE");
		post(operator, ADMIN + "/" + id + "/take-down", Map.of("reason", "unverifiable")).expectStatus().isNoContent();

		post(person, MINE + "/submit", null).expectStatus().isOk();

		String sent = mine(person);
		assertThat(JsonPath.<String>read(sent, "$.profile.status")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(sent, "$.profile.suspendedAt")).isNotNull();
		assertThat(listed("in_review")).contains(id.toString());
		client.get().uri(DIRECTORY + "/corrected-person").exchange().expectStatus().isNotFound();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		assertThat(JsonPath.<String>read(mine(person), "$.profile.suspendedAt")).isNull();
		client.get().uri(DIRECTORY + "/corrected-person").exchange().expectStatus().isOk();
	}

	@Test
	void aPersonDeletesTheirProfileWithItsMessages() {
		String person = signIn("possum@profile.test");
		UUID id = approved(person, "Possum Person");
		post(signIn("asker@possum.test"), DIRECTORY + "/possum-person/enquiries",
				Map.of("senderName", "Lan Tran", "topic", "project", "message", "Hello")).expectStatus().isNoContent();

		client.delete()
			.uri(MINE)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isNoContent();

		assertThat(JsonPath.<Object>read(mine(person), "$.profile")).isNull();
		assertProblem(client.get().uri(DIRECTORY + "/possum-person").exchange(), 404, "TALENT_PROFILE_NOT_FOUND");
		assertThat(jdbc.sql("select count(*) from talent_enquiry where profile_id = ?").param(id).query(Long.class).single())
			.isZero();
		assertThat(events(id)).containsExactly("talent.approve", "talent.delete");
	}

	@Test
	void operatorsReadTheReportedMessagesAndNobodyElse() {
		approved(signIn("wallaby@profile.test"), "Wallaby Person");
		String sender = signIn("spammer@wallaby.test");
		post(sender, DIRECTORY + "/wallaby-person/enquiries", Map.of("senderName", "Lan Tran", "topic", "other", "message", "Cheap followers"))
			.expectStatus()
			.isNoContent();
		String person = signIn("wallaby@profile.test");
		String id = JsonPath.read(mine(person), "$.enquiries[0].id");
		post(person, MINE + "/enquiries/" + id + "/report", null).expectStatus().isNoContent();

		String reported = body(get(operator, "/api/talent/admin/reported-enquiries").expectStatus().isOk());

		assertThat(JsonPath.<List<String>>read(reported, "$.items[?(@.message == 'Cheap followers')].senderEmail"))
			.containsExactly("spammer@wallaby.test");
		assertThat(JsonPath.<List<String>>read(reported, "$.items[?(@.message == 'Cheap followers')].profileName"))
			.containsExactly("Wallaby Person");
		assertProblem(get(person, "/api/talent/admin/reported-enquiries"), 403, "IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void theDirectoryShowsOnlyApprovedListedProfilesWithoutTheirAddress() {
		approved(signIn("wombat.engineer@profile.test"), "Wombat Engineer");
		Map<String, Object> scientist = described("Wombat Scientist", null);
		scientist.put("roles", List.of("data_scientist"));
		approved(signIn("wombat.scientist@profile.test"), scientist);
		Map<String, Object> hidden = described("Wombat Hidden", null);
		hidden.put("listed", false);
		approved(signIn("wombat.hidden@profile.test"), hidden);
		submitted(signIn("wombat.waiting@profile.test"), "Wombat Waiting");
		put(signIn("wombat.draft@profile.test"), MINE, described("Wombat Draft", null)).expectStatus().isOk();

		// Anyone reads the directory, without a session.
		String all = body(client.get().uri(DIRECTORY + "?q=WOMBAT").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(all, "$.items[*].name")).containsExactly("Wombat Engineer",
				"Wombat Scientist");
		assertThat(JsonPath.<Integer>read(all, "$.total")).isEqualTo(2);
		assertThat(all).doesNotContain("@profile.test");
		assertThat(names(DIRECTORY + "?q=wombat&role=data_scientist")).containsExactly("Wombat Scientist");
		// A skill is searched too.
		assertThat(names(DIRECTORY + "?q=langgraph")).contains("Wombat Engineer", "Wombat Scientist");
		// The most recently approved comes first when that order is asked for.
		assertThat(names(DIRECTORY + "?q=wombat&sort=newest")).containsExactly("Wombat Scientist", "Wombat Engineer");
		assertProblem(client.get().uri(DIRECTORY + "?role=wizard").exchange(), 400, "REQUEST_INVALID");
		assertProblem(client.get().uri(DIRECTORY + "?sort=random").exchange(), 400, "REQUEST_INVALID");

		String one = body(client.get().uri(DIRECTORY + "/wombat-engineer").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.headline")).isEqualTo("Builds claims AI");
		assertThat(JsonPath.<List<String>>read(one, "$.projects[*].title")).containsExactly("Claims triage");
		assertThat(one).doesNotContain("@profile.test");
		// An address does not reveal a profile that is not shown.
		for (String slug : List.of("wombat-hidden", "wombat-waiting", "wombat-draft")) {
			assertProblem(client.get().uri(DIRECTORY + "/" + slug).exchange(), 404, "TALENT_PROFILE_NOT_FOUND");
		}

		// Operators read everything that was sent, those that wait first, and never a draft.
		String forOperators = body(get(operator, ADMIN + "?q=wombat").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(forOperators, "$.total")).isEqualTo(4);
		assertThat(JsonPath.<String>read(forOperators, "$.items[0].name")).isEqualTo("Wombat Waiting");
		assertThat(JsonPath.<String>read(forOperators, "$.items[0].email")).isEqualTo("wombat.waiting@profile.test");
		assertProblem(get(signIn("visitor@profile.test"), ADMIN), 403, "IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void aMessageWaitsForThePersonAndSharesNoAddressUntilAccepted() {
		String person = signIn("numbat@profile.test");
		approved(person, "Numbat Person");
		String path = DIRECTORY + "/numbat-person/enquiries";
		Map<String, Object> message = Map.of("senderName", "Lan Tran", "topic", "project", "message", "  We need a claims model by March.  ");

		client.post()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(message)
			.exchange()
			.expectStatus()
			.isUnauthorized();
		assertProblem(post(person, path, message), 409, "TALENT_OWN_PROFILE");
		String buyer = organizationOwner("buyer@numbat.test", "Numbat Insurance");
		assertProblem(post(buyer, path, Map.of("senderName", "Lan Tran", "topic", "project", "message", " ")), 400, "REQUEST_INVALID");
		assertProblem(post(buyer, path, Map.of("senderName", "Lan Tran", "topic", "gossip", "message", "Hello")), 400,
				"REQUEST_INVALID");
		// A message is always signed with a name.
		assertProblem(post(buyer, path, Map.of("senderName", " ", "topic", "project", "message", "Hello")), 400,
				"REQUEST_INVALID");
		assertProblem(post(buyer, DIRECTORY + "/nobody-here/enquiries", message), 404, "TALENT_PROFILE_NOT_FOUND");
		assertThat(JsonPath.<Object>read(body(get(buyer, DIRECTORY + "/numbat-person").expectStatus().isOk()),
				"$.waitingEnquirySentAt")).isNull();

		post(buyer, path, message).expectStatus().isNoContent();

		// The person is told who wrote and from where, without the sender's address.
		assertThat(mail.latestSubjectTo("numbat@profile.test"))
			.isEqualTo("A message through your BeyondPilot talent profile");
		assertThat(mail.latestTextTo("numbat@profile.test")).contains("Numbat Insurance")
			.contains("about a project")
			.doesNotContain("buyer@numbat.test");
		assertProblem(post(buyer, path, message), 409, "TALENT_ENQUIRY_PENDING");
		assertThat(JsonPath.<String>read(body(get(buyer, DIRECTORY + "/numbat-person").expectStatus().isOk()),
				"$.waitingEnquirySentAt")).isNotNull();
		String read = mine(person);
		assertThat(JsonPath.<List<String>>read(read, "$.enquiries[*].message"))
			.containsExactly("We need a claims model by March.");
		assertThat(JsonPath.<String>read(read, "$.enquiries[0].status")).isEqualTo("pending");
		assertThat(JsonPath.<String>read(read, "$.enquiries[0].senderOrganization")).isEqualTo("Numbat Insurance");
		assertThat(JsonPath.<Object>read(read, "$.enquiries[0].senderEmail")).isNull();
		// The person reads the name the sender gave, never the sender's address.
		assertThat(JsonPath.<String>read(read, "$.enquiries[0].senderName")).isEqualTo("Lan Tran");
		assertThat(read).doesNotContain("buyer@numbat.test");
		assertThat(JsonPath.<String>read(read, "$.enquiries[0].closesAt")).isNotNull();
		String id = JsonPath.read(read, "$.enquiries[0].id");
		// Another person cannot answer it.
		approved(signIn("other@numbat.test"), "Numbat Other");
		assertProblem(post(signIn("other@numbat.test"), MINE + "/enquiries/" + id + "/accept", null), 404,
				"TALENT_ENQUIRY_NOT_FOUND");

		post(person, MINE + "/enquiries/" + id + "/accept", null).expectStatus().isNoContent();

		assertThat(mail.latestTextTo("buyer@numbat.test")).contains("numbat@profile.test");
		assertThat(mail.latestTextTo("numbat@profile.test")).contains("buyer@numbat.test").contains("Numbat Insurance");
		String accepted = mine(person);
		assertThat(JsonPath.<String>read(accepted, "$.enquiries[0].status")).isEqualTo("accepted");
		assertThat(JsonPath.<String>read(accepted, "$.enquiries[0].senderEmail")).isEqualTo("buyer@numbat.test");
		assertThat(JsonPath.<Object>read(accepted, "$.enquiries[0].closesAt")).isNull();
		assertProblem(post(person, MINE + "/enquiries/" + id + "/decline", null), 409, "TALENT_ENQUIRY_NOT_PENDING");
		assertThat(events("talent_enquiry", UUID.fromString(id))).containsExactly("talent.enquiry_accept");
		// An answer lets the sender write again.
		post(buyer, path, Map.of("senderName", "Lan Tran", "topic", "role", "message", "And a role?")).expectStatus().isNoContent();
		// The sender reads nothing of it on their own page.
		assertThat(JsonPath.<List<Object>>read(mine(buyer), "$.enquiries")).isEmpty();
	}

	@Test
	void aDeclineAndAReportReadTheSameToTheSenderAndShareNoAddress() {
		String person = signIn("quokka@profile.test");
		approved(person, "Quokka Person");
		String path = DIRECTORY + "/quokka-person/enquiries";
		String first = signIn("first@quokka.test");
		String second = signIn("second@quokka.test");
		post(first, path, Map.of("senderName", "Lan Tran", "topic", "other", "message", "Can we talk?")).expectStatus().isNoContent();
		post(second, path, Map.of("senderName", "Lan Tran", "topic", "other", "message", "Buy followers now")).expectStatus().isNoContent();
		String read = mine(person);
		String fromSecond = JsonPath.<List<String>>read(read, "$.enquiries[?(@.message == 'Buy followers now')].id")
			.get(0);
		String fromFirst = JsonPath.<List<String>>read(read, "$.enquiries[?(@.message == 'Can we talk?')].id").get(0);

		post(person, MINE + "/enquiries/" + fromFirst + "/decline", null).expectStatus().isNoContent();
		post(person, MINE + "/enquiries/" + fromSecond + "/report", null).expectStatus().isNoContent();

		String declined = mail.latestTextTo("first@quokka.test");
		String reported = mail.latestTextTo("second@quokka.test");
		assertThat(declined).isEqualTo(reported).contains("Quokka Person").doesNotContain("quokka@profile.test");
		assertThat(mail.latestSubjectTo("second@quokka.test")).isEqualTo("Your message to Quokka Person");
		String after = mine(person);
		assertThat(JsonPath.<List<String>>read(after, "$.enquiries[*].status")).containsExactlyInAnyOrder("declined",
				"reported");
		assertThat(JsonPath.<List<Object>>read(after, "$.enquiries[*].senderEmail")).containsOnlyNulls();
		assertThat(events("talent_enquiry", UUID.fromString(fromSecond))).containsExactly("talent.enquiry_report");
	}

	@Test
	void aSenderStartsTenConversationsADay() {
		UUID profile = approved(signIn("dingo@profile.test"), "Dingo Person");
		String sender = signIn("busy@dingo.test");
		UUID account = jdbc.sql("select id from identity_account where email = 'busy@dingo.test'")
			.query(UUID.class)
			.single();
		for (int sent = 0; sent < TalentService.ENQUIRIES_A_DAY; sent++) {
			jdbc.sql("""
					insert into talent_enquiry (id, profile_id, sender_account_id, topic, message, status)
					values (?, ?, ?, 'other', 'Earlier today', 'declined')
					""").params(UUID.randomUUID(), profile, account).update();
		}
		approved(signIn("emu@profile.test"), "Emu Person");

		assertProblem(post(sender, DIRECTORY + "/emu-person/enquiries", Map.of("senderName", "Lan Tran", "topic", "role", "message", "Hi")), 429,
				"TALENT_ENQUIRY_LIMIT");
	}

	@Test
	void aMessageNobodyAnswersIsRemindedOnceAndClosesAfterFourteenDays() {
		String person = signIn("koala@profile.test");
		approved(person, "Koala Person");
		String sender = signIn("patient@koala.test");
		post(sender, DIRECTORY + "/koala-person/enquiries", Map.of("senderName", "Lan Tran", "topic", "project", "message", "Still there?"))
			.expectStatus()
			.isNoContent();
		Instant now = Instant.now();

		assertThat(clock.remind(now.plus(Duration.ofDays(8)))).isPositive();
		String reminder = mail.latestTextTo("koala@profile.test");
		assertThat(mail.latestSubjectTo("koala@profile.test"))
			.isEqualTo("A message waits for your answer on BeyondPilot");
		clock.remind(now.plus(Duration.ofDays(9)));
		// One reminder, not one a run.
		assertThat(mail.latestTextTo("koala@profile.test")).isEqualTo(reminder);

		assertThat(clock.close(now.plus(Duration.ofDays(15)))).isPositive();

		assertThat(JsonPath.<String>read(mine(person), "$.enquiries[0].status")).isEqualTo("closed");
		assertThat(mail.latestSubjectTo("patient@koala.test")).isEqualTo("Your message to Koala Person closed");
		assertThat(mail.latestTextTo("patient@koala.test")).doesNotContain("koala@profile.test");
		// The sender may write again.
		post(sender, DIRECTORY + "/koala-person/enquiries", Map.of("senderName", "Lan Tran", "topic", "project", "message", "Once more"))
			.expectStatus()
			.isNoContent();
	}

	@Test
	void aProfileStatesItsFactsAndTheDirectoryNarrowsByCountryAndEngagement() {
		Map<String, Object> facts = described("Echidna Engineer", null);
		facts.put("country", "SG");
		facts.put("engagement", List.of("advisory"));
		facts.put("projects", List.of(Map.of("title", "Voice agent for a bank", "stage", "in_production"),
				Map.of("title", "Evaluation set")));
		approved(signIn("echidna@profile.test"), facts);
		approved(signIn("echidna.other@profile.test"), described("Echidna Other", null));

		String one = body(client.get().uri(DIRECTORY + "/echidna-engineer").exchange().expectStatus().isOk());

		assertThat(JsonPath.<String>read(one, "$.city")).isEqualTo("Ho Chi Minh City");
		assertThat(JsonPath.<List<String>>read(one, "$.languages")).containsExactly("vi", "en");
		assertThat(JsonPath.<List<String>>read(one, "$.industries")).containsExactly("insurance");
		assertThat(JsonPath.<String>read(one, "$.worksAt")).isEqualTo("Revee AI");
		assertThat(JsonPath.<List<String>>read(one, "$.projects[*].stage")).containsExactly("in_production", null);
		// The rate is the person's and GenAI Fund's, not the public's.
		assertThat(one).doesNotContain("rateBand");

		String bySingapore = body(client.get().uri(DIRECTORY + "?q=echidna&country=SG").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(bySingapore, "$.items[*].name")).containsExactly("Echidna Engineer");
		assertThat(JsonPath.<Integer>read(bySingapore, "$.items[0].projectCount")).isEqualTo(2);
		assertThat(JsonPath.<String>read(bySingapore, "$.items[0].leadProject.title")).isEqualTo("Voice agent for a bank");
		assertThat(JsonPath.<String>read(bySingapore, "$.items[0].leadProject.stage")).isEqualTo("in_production");
		assertThat(names(DIRECTORY + "?q=echidna&engagement=advisory")).containsExactly("Echidna Engineer");
		// A buyer finds people by the industry they worked in, and by the words of a project.
		assertThat(names(DIRECTORY + "?q=echidna&industry=insurance")).containsExactly("Echidna Engineer",
				"Echidna Other");
		assertThat(names(DIRECTORY + "?q=echidna&industry=healthcare")).isEmpty();
		assertThat(names(DIRECTORY + "?q=bank")).containsExactly("Echidna Engineer");
		assertThat(names(DIRECTORY + "?q=echidna&engagement=contract")).containsExactly("Echidna Other");
		assertProblem(client.get().uri(DIRECTORY + "?country=sg").exchange(), 400, "REQUEST_INVALID");
	}

	@Test
	void aPhotoMustBeAnUploadOfTheCallerForAProfile() {
		Map<String, Object> request = described("Bilby Person", null);
		request.put("photoFileId", UUID.randomUUID().toString());

		assertProblem(put(signIn("bilby@profile.test"), MINE, request), 400, "TALENT_PHOTO_NOT_USABLE");
	}

	@Test
	void everythingButTheDirectoryNeedsASession() {
		client.get().uri(DIRECTORY).exchange().expectStatus().isOk();

		client.get().uri(MINE).exchange().expectStatus().isUnauthorized();
		client.get().uri(ADMIN).exchange().expectStatus().isUnauthorized();
	}

	/** A profile as its edit screen sends it, with what a submission needs. */
	private static Map<String, Object> described(String name, Long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("headline", "Builds claims AI");
		request.put("bio", "Ten years of machine learning in insurance.");
		request.put("roles", List.of("ml_engineer"));
		request.put("skills", List.of("Python", "LangGraph"));
		request.put("country", "VN");
		request.put("engagement", List.of("contract"));
		request.put("rateBand", "50_100");
		request.put("website", "https://example.test");
		request.put("photoFileId", null);
		request.put("city", "Ho Chi Minh City");
		request.put("languages", List.of("vi", "en"));
		request.put("industries", List.of("insurance"));
		request.put("worksAt", "Revee AI");
		request.put("projects", List.of(Map.of("title", "Claims triage", "year", 2025, "stage", "pilot")));
		request.put("listed", true);
		request.put("version", version);
		return request;
	}

	private static long versionOf(String profile) {
		return JsonPath.<Number>read(profile, "$.version").longValue();
	}

	private UUID submitted(String session, String name) {
		return submitted(session, described(name, null));
	}

	private UUID submitted(String session, Map<String, Object> description) {
		put(session, MINE, description).expectStatus().isOk();
		return UUID.fromString(JsonPath.read(body(post(session, MINE + "/submit", null).expectStatus().isOk()), "$.id"));
	}

	private UUID approved(String session, String name) {
		return approved(session, described(name, null));
	}

	private UUID approved(String session, Map<String, Object> description) {
		UUID id = submitted(session, description);
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		return id;
	}

	private String mine(String session) {
		return body(get(session, MINE).expectStatus().isOk());
	}

	/** The identifiers on the first page of the operators' list narrowed to a status. */
	private List<String> listed(String status) {
		return JsonPath.read(body(get(operator, ADMIN + "?status=" + status).expectStatus().isOk()), "$.items[*].id");
	}

	private List<String> names(String path) {
		return JsonPath.read(body(client.get().uri(path).exchange().expectStatus().isOk()), "$.items[*].name");
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

	private List<String> events(UUID profile) {
		return events("talent", profile);
	}

	private List<String> events(String type, UUID resource) {
		return jdbc.sql("""
				select action from audit_event where resource_type = ? and resource_id = ?
				order by occurred_at, id
				""").params(type, resource.toString()).query(String.class).list();
	}

	/** The session of the owner of an approved organization. */
	private String organizationOwner(String email, String name) {
		String session = signIn(email);
		UUID organization = UUID.fromString(JsonPath.read(body(post(session, "/api/organization/organizations",
				Map.of("name", name, "type", "company", "country", "VN", "teamSize", "2_9", "industries",
						List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
		post(operator, "/api/organization/admin/organizations/" + organization + "/approve", Map.of()).expectStatus()
			.isNoContent();
		return session;
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
