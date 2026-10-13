package ai.genaifund.beyondpilot.talent;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Comparator;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Talent profiles over real HTTP against PostgreSQL: the one profile a person keeps, what a submission needs, what
 * operators decide and what the public directory shows. Only the SMTP server is replaced. Each test uses its own word in the names it searches for, because the tests share one database.
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

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
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
		// A profile nobody else sees yet is opened where its person corrects it.
		assertThat(mail.latestTextTo("reviewed@profile.test"))
			.containsPattern("https?://[^/ ]+/workspace/talent(?![\\w/-])");
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "TALENT_NOT_AWAITING_REVIEW");

		post(person, MINE + "/submit", null).expectStatus().isOk();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<String>read(mine(person), "$.profile.status")).isEqualTo("approved");
		assertThat(mail.latestSubjectTo("reviewed@profile.test")).isEqualTo("Your BeyondPilot talent profile is approved");
		// Approved and listed, it is opened as the directory shows it.
		assertThat(mail.latestTextTo("reviewed@profile.test"))
			.containsPattern("https?://[^/ ]+/talent/[a-z0-9-]+(?![\\w/-])");
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
		assertThat(mail.latestSubjectTo("removed@profile.test")).isEqualTo("Your BeyondPilot talent profile is restored");
		assertThat(mail.latestTextTo("removed@profile.test"))
			.containsPattern("https?://[^/ ]+/talent/removed-person(?![\\w/-])");
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
	void aPersonDeletesTheirProfileWithTheConversationsStartedThroughIt() {
		String person = signIn("possum@profile.test");
		UUID id = approved(person, "Possum Person");
		signIn("asker@possum.test");
		UUID conversation = UUID.randomUUID();
		jdbc.sql("""
				insert into messaging_conversation (id, kind, talent_profile_id, subject_name, starter_account_id,
				                                    recipient_account_id, status)
				select ?, 'talent', p.id, p.name, a.id, p.account_id, 'pending'
				from talent_profile p, identity_account a where p.id = ? and a.email = 'asker@possum.test'
				""").params(conversation, id).update();
		jdbc.sql("""
				insert into messaging_message (id, conversation_id, sender_account_id, body)
				select ?, c.id, c.starter_account_id, 'Hello' from messaging_conversation c where c.id = ?
				""").params(UUID.randomUUID(), conversation).update();

		client.delete()
			.uri(MINE)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isNoContent();

		assertThat(JsonPath.<Object>read(mine(person), "$.profile")).isNull();
		assertProblem(client.get().uri(DIRECTORY + "/possum-person").exchange(), 404, "TALENT_PROFILE_NOT_FOUND");
		assertThat(jdbc.sql("select count(*) from messaging_message where conversation_id = ?")
			.param(conversation)
			.query(Long.class)
			.single()).isZero();
		assertThat(events(id)).containsExactly("talent.approve", "talent.delete");
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
	void featuredProfilesLeadOnlyTheViewTheDirectoryOpensWith() {
		UUID[] people = new UUID[5];
		for (int number = 1; number <= 4; number++) {
			Map<String, Object> description = apart("Quoll Person %02d".formatted(number), null);
			if (number == 1) {
				description.put("roles", List.of("data_scientist"));
			}
			people[number] = approved(signIn("quoll%02d@profile.test".formatted(number)), description);
		}
		// What a reader gets once they search, filter or pick another order, before anything is featured.
		List<String> chosen = List.of("?q=quoll person&sort=newest", "?q=quoll person&sort=name", "?q=quoll person",
				"?role=data_scientist&sort=newest", "?country=VN&sort=newest", "?industry=insurance&sort=newest",
				"?engagement=contract&sort=newest", "?sort=name", "");
		List<List<String>> before = chosen.stream().map(query -> names(DIRECTORY + query)).toList();
		int total = JsonPath.read(body(client.get().uri(DIRECTORY + "?sort=newest").exchange().expectStatus().isOk()),
				"$.total");

		// The one featured first stays on top of the one featured after it, whatever their approvals say.
		post(operator, ADMIN + "/" + people[2] + "/feature", null).expectStatus().isNoContent();
		post(operator, ADMIN + "/" + people[1] + "/feature", null).expectStatus().isNoContent();

		// The opening view: no search, no filter, the newest first.
		String opening = body(client.get().uri(DIRECTORY + "?sort=newest").exchange().expectStatus().isOk());
		assertThat(quolls(JsonPath.read(opening, "$.items[*].name"))).containsExactly("Quoll Person 02",
				"Quoll Person 01", "Quoll Person 04", "Quoll Person 03");
		// Every featured profile of the page comes before every other one.
		assertThat(JsonPath.<List<Boolean>>read(opening, "$.items[*].featured"))
			.isSortedAccordingTo(Comparator.reverseOrder());
		// They are counted once and do not come again on a later page.
		assertThat(JsonPath.<Integer>read(opening, "$.total")).isEqualTo(total);
		assertThat(names(DIRECTORY + "?sort=newest&page=2")).doesNotContain("Quoll Person 02", "Quoll Person 01");

		// A search, a filter or another order is ordered by that alone, as it was before.
		for (int index = 0; index < chosen.size(); index++) {
			assertThat(names(DIRECTORY + chosen.get(index))).as(chosen.get(index)).isEqualTo(before.get(index));
		}
		assertThat(names(DIRECTORY + "?q=quoll person&sort=newest")).containsExactly("Quoll Person 04",
				"Quoll Person 03", "Quoll Person 02", "Quoll Person 01");
		// Its card says it is featured wherever the list shows it.
		assertThat(featured("?q=quoll person&sort=name")).containsExactly("Quoll Person 01", "Quoll Person 02");

		// No longer featured, a profile goes back to its place.
		post(operator, ADMIN + "/" + people[2] + "/unfeature", null).expectStatus().isNoContent();
		assertThat(quolls(names(DIRECTORY + "?sort=newest"))).containsExactly("Quoll Person 01", "Quoll Person 04",
				"Quoll Person 03", "Quoll Person 02");
	}

	@Test
	void theOperatorsListSortsByTheKeyItIsGivenAndRefusesAnUnknownOne() {
		// Sent back rather than approved, so that it stays out of the directory other tests read.
		UUID bravo = submitted(signIn("bandicoot.bravo@profile.test"), "Bandicoot Bravo");
		post(operator, ADMIN + "/" + bravo + "/send-back", Map.of("reason", "incomplete", "message", "Say more."))
			.expectStatus()
			.isNoContent();
		submitted(signIn("bandicoot.alpha@profile.test"), "Bandicoot Alpha");
		submitted(signIn("bandicoot.charlie@profile.test"), "Bandicoot Charlie");
		jdbc.sql("""
				update talent_profile set submitted_at = now() - case name when 'Bandicoot Bravo' then interval '3 days'
				                                                           when 'Bandicoot Alpha' then interval '1 day'
				                                                           else interval '2 days' end
				where name like 'Bandicoot %'
				""").update();

		assertThat(adminNames("&sort=name")).containsExactly("Bandicoot Alpha", "Bandicoot Bravo",
				"Bandicoot Charlie");
		assertThat(adminNames("&sort=-name")).containsExactly("Bandicoot Charlie", "Bandicoot Bravo",
				"Bandicoot Alpha");
		assertThat(adminNames("&sort=submitted")).containsExactly("Bandicoot Bravo", "Bandicoot Charlie",
				"Bandicoot Alpha");
		assertThat(adminNames("&sort=-submitted")).containsExactly("Bandicoot Alpha", "Bandicoot Charlie",
				"Bandicoot Bravo");
		// Without a key, those waiting for review first, the longest wait on top.
		assertThat(adminNames("")).containsExactly("Bandicoot Charlie", "Bandicoot Alpha", "Bandicoot Bravo");
		assertProblem(get(operator, ADMIN + "?sort=newest"), 400, "REQUEST_INVALID");
	}

	private List<String> adminNames(String query) {
		return JsonPath.read(body(get(operator, ADMIN + "?q=bandicoot" + query).expectStatus().isOk()), "$.items[*].name");
	}

	@Test
	void onlyAnOperatorFeaturesAProfileWhichStaysFeaturedThroughWhatItsPersonAndGenAiFundDo() {
		approved(signIn("bilby.alpha@profile.test"), apart("Bilby Alpha", null));
		String person = signIn("bilby.zulu@profile.test");
		UUID chosen = approved(person, apart("Bilby Zulu", null));
		UUID waiting = submitted(signIn("bilby.waiting@profile.test"), apart("Bilby Waiting", null));
		String drafter = signIn("bilby.draft@profile.test");
		UUID draft = UUID.fromString(JsonPath
			.read(body(put(drafter, MINE, apart("Bilby Draft", null)).expectStatus().isOk()), "$.id"));

		assertProblem(post(person, ADMIN + "/" + chosen + "/feature", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(person, ADMIN + "/" + chosen + "/unfeature", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		client.post().uri(ADMIN + "/" + chosen + "/feature").header(TestSignIn.CSRF_HEADER, "1").exchange().expectStatus()
			.isUnauthorized();
		// A draft is its person's alone, and what does not exist cannot be featured.
		assertProblem(post(operator, ADMIN + "/" + draft + "/feature", null), 404, "TALENT_PROFILE_NOT_FOUND");
		assertProblem(post(operator, ADMIN + "/" + UUID.randomUUID() + "/unfeature", null), 404,
				"TALENT_PROFILE_NOT_FOUND");
		assertThat(featured("?q=bilby")).isEmpty();

		// What the person read before is still what they save: featuring is not a change of theirs.
		long version = JsonPath.<Number>read(mine(person), "$.profile.version").longValue();
		post(operator, ADMIN + "/" + chosen + "/feature", null).expectStatus().isNoContent();
		String featuredAt = JsonPath.read(body(get(operator, ADMIN + "/" + chosen).expectStatus().isOk()), "$.featuredAt");
		assertThat(featuredAt).isNotNull();
		// Featured again, it keeps the time it was featured and nothing new is recorded.
		post(operator, ADMIN + "/" + chosen + "/feature", null).expectStatus().isNoContent();
		assertThat(JsonPath.<String>read(body(get(operator, ADMIN + "/" + chosen).expectStatus().isOk()), "$.featuredAt"))
			.isEqualTo(featuredAt);
		assertThat(events(chosen)).containsExactly("talent.approve", "talent.feature");
		// A search is ordered by what the reader chose; the card says which one is featured.
		assertThat(names(DIRECTORY + "?q=bilby")).containsExactly("Bilby Alpha", "Bilby Zulu");
		assertThat(featured("?q=bilby")).containsExactly("Bilby Zulu");

		Map<String, Object> change = apart("Bilby Zulu", version);
		change.put("headline", "Builds claims AI faster");
		put(person, MINE, change).expectStatus().isOk();
		assertThat(featured("?q=bilby")).containsExactly("Bilby Zulu");

		// The operators' list marks it and narrows to the featured ones, or to the others.
		String onlyFeatured = body(get(operator, ADMIN + "?q=bilby&featured=true").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(onlyFeatured, "$.items[*].name")).containsExactly("Bilby Zulu");
		assertThat(JsonPath.<Integer>read(onlyFeatured, "$.total")).isEqualTo(1);
		assertThat(JsonPath.<String>read(onlyFeatured, "$.items[0].featuredAt")).isEqualTo(featuredAt);
		assertThat(JsonPath.<List<String>>read(body(get(operator, ADMIN + "?q=bilby&featured=false").expectStatus().isOk()),
				"$.items[*].name"))
			.containsExactlyInAnyOrder("Bilby Waiting", "Bilby Alpha");

		// A profile that is not public is featured all the same, and is shown as featured from the moment it is.
		post(operator, ADMIN + "/" + waiting + "/feature", null).expectStatus().isNoContent();
		assertThat(featured("?q=bilby")).containsExactly("Bilby Zulu");
		post(operator, ADMIN + "/" + waiting + "/approve", null).expectStatus().isNoContent();
		assertThat(featured("?q=bilby")).containsExactly("Bilby Waiting", "Bilby Zulu");
		// Taken down, it leaves the directory and stays featured; restored, it is back as it was.
		post(operator, ADMIN + "/" + chosen + "/take-down", Map.of("reason", "unverifiable")).expectStatus()
			.isNoContent();
		assertThat(names(DIRECTORY + "?q=bilby")).containsExactly("Bilby Alpha", "Bilby Waiting");
		assertThat(JsonPath.<List<String>>read(body(get(operator, ADMIN + "?q=bilby&featured=true").expectStatus().isOk()),
				"$.items[*].name"))
			.containsExactlyInAnyOrder("Bilby Zulu", "Bilby Waiting");
		post(operator, ADMIN + "/" + chosen + "/restore", null).expectStatus().isNoContent();
		assertThat(featured("?q=bilby")).containsExactly("Bilby Waiting", "Bilby Zulu");

		post(operator, ADMIN + "/" + chosen + "/unfeature", null).expectStatus().isNoContent();
		post(operator, ADMIN + "/" + chosen + "/unfeature", null).expectStatus().isNoContent();
		assertThat(JsonPath.<Object>read(body(get(operator, ADMIN + "/" + chosen).expectStatus().isOk()), "$.featuredAt"))
			.isNull();
		assertThat(featured("?q=bilby")).containsExactly("Bilby Waiting");
		assertThat(events(chosen)).containsExactly("talent.approve", "talent.feature", "talent.remove", "talent.restore",
				"talent.unfeature");
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

	/**
	 * A profile as {@link #described} with a skill no other test searches for, so the pages those tests read keep the
	 * profiles they expect.
	 */
	private static Map<String, Object> apart(String name, Long version) {
		Map<String, Object> request = described(name, version);
		request.put("skills", List.of("Fortran"));
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

	/** Those of the names that are the profiles of the featuring test, in the order they came. */
	private static List<String> quolls(List<String> names) {
		return names.stream().filter(name -> name.startsWith("Quoll Person")).toList();
	}

	/** The names of the profiles a page of the directory marks as featured, in the order they came. */
	private List<String> featured(String query) {
		return JsonPath.read(body(client.get().uri(DIRECTORY + query).exchange().expectStatus().isOk()),
				"$.items[?(@.featured == true)].name");
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
		return jdbc.sql("""
				select action from audit_event where resource_type = 'talent' and resource_id = ?
				order by occurred_at, id
				""").param(profile.toString()).query(String.class).list();
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
