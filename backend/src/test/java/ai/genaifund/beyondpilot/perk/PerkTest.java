package ai.genaifund.beyondpilot.perk;

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
import org.jspecify.annotations.Nullable;
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
 * Perks over real HTTP against PostgreSQL: who writes and publishes them, what the catalogue shows, and how a team gets
 * one: a link, a shared code, a code of its own from a list, or a request its partner answers. Only the SMTP server is
 * replaced. Each test uses its own email domains, because a domain belongs to one organization. A perk for a program's
 * applicants or shortlist is tested with the programs, in {@code ReviewTest}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, PerkTest.Mail.class })
class PerkTest {

	private static final String ORGANIZATION = "/api/organization";

	private static final String PERKS = "/api/perk/perks";

	private static final String MINE = "/api/perk/mine";

	private static final String ADMIN = "/api/perk/admin/perks";

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
	void anOperatorWritesAPerkForTheOrganizationThatGivesItAndOnlyOperatorsChangeOneGenAiFundArranged() {
		String founder = owner("founder@platypus-perks.test", "Platypus Cloud");
		UUID organization = organizationOf(founder);
		Map<String, Object> credits = perk("  $1,000  Platypus credits ");

		// Only an operator writes for an organization; a perk's title is one line and its addresses are https ones.
		assertProblem(post(founder, ADMIN, admin(organization, credits)), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(get(founder, ADMIN), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(post(operator, ADMIN, admin(organization, perk("x".repeat(81)))), 400, "REQUEST_INVALID");
		Map<String, Object> overHttp = perk("Platypus over http");
		overHttp.put("url", "http://perks.example.test/platypus");
		assertProblem(post(operator, ADMIN, admin(organization, overHttp)), 400, "REQUEST_INVALID");
		Map<String, Object> script = perk("Platypus script");
		script.put("url", "javascript:alert(1)");
		assertProblem(post(operator, ADMIN, admin(organization, script)), 400, "REQUEST_INVALID");
		// A link perk is its link.
		Map<String, Object> noLink = perk("Platypus without a link");
		noLink.put("url", null);
		assertProblem(post(operator, ADMIN, admin(organization, noLink)), 400, "PERK_INCOMPLETE");
		assertProblem(post(operator, ADMIN, admin(UUID.randomUUID(), credits)), 404, "PERK_ORGANIZATION_NOT_FOUND");

		String created = body(post(operator, ADMIN, admin(organization, credits)).expectStatus().isCreated());
		UUID id = idOf(created);
		assertThat(JsonPath.<String>read(created, "$.title")).isEqualTo("$1,000 Platypus credits");
		assertThat(JsonPath.<String>read(created, "$.slug")).isEqualTo("platypus-cloud-1-000-platypus-credits");
		assertThat(JsonPath.<String>read(created, "$.organizationName")).isEqualTo("Platypus Cloud");
		assertThat(JsonPath.<String>read(created, "$.state")).isEqualTo("draft");
		assertThat(JsonPath.<Boolean>read(created, "$.fromGenAiFund")).isTrue();
		assertThat(JsonPath.<Boolean>read(body(get(operator, ADMIN + "/" + id).expectStatus().isOk()),
				"$.fromGenAiFund")).as("the mark as stored").isTrue();
		// Two perks of one organization that read the same could not be told apart.
		assertProblem(post(operator, ADMIN, admin(organization, perk("$1,000 PLATYPUS credits"))), 409,
				"PERK_TITLE_TAKEN");

		// A save sends the version its form read.
		assertProblem(put(operator, ADMIN + "/" + id, admin(null, credits)), 409, "PERK_CHANGED_MEANWHILE");
		Map<String, Object> doubled = versioned(credits, created);
		doubled.put("value", "$2,000");
		String saved = body(put(operator, ADMIN + "/" + id, admin(null, doubled)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(saved, "$.value")).isEqualTo("$2,000");
		assertProblem(put(operator, ADMIN + "/" + id, admin(null, doubled)), 409, "PERK_CHANGED_MEANWHILE");

		// The organization reads the perk GenAI Fund arranged among its own, and only GenAI Fund changes it.
		String mine = body(get(founder, MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<Boolean>>read(mine, "$[?(@.id == '" + id + "')].fromGenAiFund")).containsExactly(true);
		assertThat(JsonPath.<Boolean>read(body(get(founder, MINE + "/" + id).expectStatus().isOk()), "$.editable"))
			.isFalse();
		assertProblem(put(founder, MINE + "/" + id, versioned(doubled, saved)), 403, "PERK_ARRANGED");
		assertProblem(post(founder, MINE + "/" + id + "/publish", null), 403, "PERK_ARRANGED");
		assertProblem(delete(founder, MINE + "/" + id), 403, "PERK_ARRANGED");
		// Another organization finds no such perk.
		String neighbour = owner("founder@platypus-neighbour.test", "Platypus Neighbour");
		assertProblem(get(neighbour, MINE + "/" + id), 404, "PERK_NOT_FOUND");

		// A perk a team got is archived, never deleted, so what the team got stays.
		post(operator, ADMIN + "/" + id + "/publish", null).expectStatus().isOk();
		claim(neighbour, slugOf(saved), Map.of()).expectStatus().isCreated();
		assertProblem(delete(operator, ADMIN + "/" + id), 409, "PERK_IN_USE");
		String archived = body(post(operator, ADMIN + "/" + id + "/archive", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(archived, "$.state")).isEqualTo("archived");
		assertThat(events(id)).containsExactly("perk.create", "perk.update", "perk.publish", "perk.archive");

		UUID spare = idOf(body(post(operator, ADMIN, admin(organization, perk("Platypus spare"))).expectStatus().isCreated()));
		delete(operator, ADMIN + "/" + spare).expectStatus().isNoContent();
		assertProblem(get(operator, ADMIN + "/" + spare), 404, "PERK_NOT_FOUND");
	}

	@Test
	void anOrganizationPublishesItsOwnPerkWithNoReviewAndItGoesWithItsOwnSolutionsOnly() {
		assertProblem(post(signIn("nobody@no-perks.test"), MINE, perk("Nobody's perk")), 403, "PERK_MEMBER_REQUIRED");
		String founder = owner("founder@cassowary-perks.test", "Cassowary AI");
		String neighbour = owner("founder@cassowary-neighbour.test", "Cassowary Neighbour");
		UUID solution = solution(founder, "Cassowary Desk");
		UUID theirs = solution(neighbour, "Neighbour Desk");

		Map<String, Object> pilot = perk("Cassowary pilot package");
		pilot.put("audience", "everyone");
		pilot.put("summary", "Six weeks of a pilot on your own claims.");
		pilot.put("solutionIds", List.of(theirs));
		assertProblem(post(founder, MINE, pilot), 400, "PERK_SOLUTION_NOT_USABLE");
		// The form chooses among the organization's own solutions.
		String options = body(get(founder, MINE + "/options").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(options, "$.solutions[*].id")).containsExactly(solution.toString());
		pilot.put("solutionIds", List.of(solution));
		String draft = body(post(founder, MINE, pilot).expectStatus().isCreated());
		UUID id = idOf(draft);
		String slug = slugOf(draft);
		assertThat(JsonPath.<Boolean>read(draft, "$.fromGenAiFund")).isFalse();
		assertThat(JsonPath.<Boolean>read(draft, "$.editable")).isTrue();

		// A draft is read by its keepers only.
		assertThat(catalogue(null, false)).doesNotContain(slug);
		assertProblem(client.get().uri(PERKS + "/" + slug).exchange(), 404, "PERK_NOT_FOUND");
		assertThat(lines(solution)).isEmpty();
		assertProblem(post(neighbour, MINE + "/" + id + "/publish", null), 404, "PERK_NOT_FOUND");

		// Published, it is for anyone to read at once, with no review; a link for everyone is open to a visitor.
		post(founder, MINE + "/" + id + "/publish", null).expectStatus().isOk();
		assertThat(catalogue(null, false)).contains(slug);
		String page = body(client.get().uri(PERKS + "/" + slug).exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.card.organizationName")).isEqualTo("Cassowary AI");
		assertThat(JsonPath.<String>read(page, "$.card.standing")).isEqualTo("eligible");
		assertThat(JsonPath.<String>read(page, "$.url")).isEqualTo("https://perks.example.test/cassowary-pilot-package");
		// The card of the solution it goes with names it.
		assertThat(lines(solution)).containsExactly("Cassowary pilot package");
		assertThat(JsonPath.<List<String>>read(body(get(founder, MINE).expectStatus().isOk()), "$[*].state"))
			.containsExactly("published");

		// Archived, it leaves the site; published again, it is back.
		post(founder, MINE + "/" + id + "/archive", null).expectStatus().isOk();
		assertThat(catalogue(null, false)).doesNotContain(slug);
		assertProblem(client.get().uri(PERKS + "/" + slug).exchange(), 404, "PERK_NOT_FOUND");
		assertThat(lines(solution)).isEmpty();
		post(founder, MINE + "/" + id + "/publish", null).expectStatus().isOk();
		assertThat(lines(solution)).containsExactly("Cassowary pilot package");
	}

	@Test
	void aCodeForMembersIsShownOnlyToATeamThatTakesItAndTheTeamHoldsItOnce() {
		String partner = owner("founder@kangaroo-perks.test", "Kangaroo Cloud");
		Map<String, Object> credits = perk("Kangaroo credits");
		credits.put("way", "code");
		credits.put("url", null);
		credits.put("code", "KANGAROO-100");
		credits.put("redeemUrl", "https://perks.example.test/kangaroo-redeem");
		String created = body(post(operator, ADMIN, admin(organizationOf(partner), credits)).expectStatus().isCreated());
		UUID id = idOf(created);
		String slug = slugOf(created);
		post(operator, ADMIN + "/" + id + "/publish", null).expectStatus().isOk();

		// Anyone reads who it is for; the code is never on its page.
		String visitor = body(client.get().uri(PERKS + "/" + slug).exchange().expectStatus().isOk());
		assertThat(visitor).doesNotContain("KANGAROO-100");
		assertThat(JsonPath.<String>read(visitor, "$.card.standing")).isEqualTo("sign_in");
		client.post()
			.uri(PERKS + "/" + slug + "/claims")
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("answers", Map.of()))
			.exchange()
			.expectStatus()
			.isUnauthorized();
		String loner = signIn("loner@no-team.test");
		assertThat(standing(loner, slug)).isEqualTo("organization");
		assertProblem(claim(loner, slug, Map.of()), 403, "PERK_ORGANIZATION_REQUIRED");

		// A member takes it for their team, and the team holds it once, whoever asks again.
		String lead = owner("lead@wombat-team.test", "Wombat Team");
		assertThat(standing(lead, slug)).isEqualTo("eligible");
		String taken = body(claim(lead, slug, Map.of()).expectStatus().isCreated());
		assertThat(JsonPath.<String>read(taken, "$.state")).isEqualTo("taken");
		assertThat(JsonPath.<String>read(taken, "$.code")).isEqualTo("KANGAROO-100");
		assertThat(JsonPath.<String>read(taken, "$.redeemUrl")).isEqualTo("https://perks.example.test/kangaroo-redeem");
		String colleague = colleague(lead, "colleague@wombat-team.test");
		String page = body(get(colleague, PERKS + "/" + slug).expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.card.standing")).isEqualTo("claimed");
		assertThat(JsonPath.<String>read(page, "$.claim.code")).isEqualTo("KANGAROO-100");
		assertThat(JsonPath.<String>read(page, "$.claim.takenBy")).isEqualTo("lead@wombat-team.test");
		String again = body(claim(colleague, slug, Map.of()).expectStatus().isCreated());
		assertThat(idOf(again)).isEqualTo(idOf(taken));

		// The team finds it in My organization, and its keepers read who got it.
		String team = body(get(colleague, "/api/perk/claims").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(team, "$[*].slug")).containsExactly(slug);
		assertThat(JsonPath.<List<String>>read(team, "$[*].partnerName")).containsExactly("Kangaroo Cloud");
		assertThat(JsonPath.<List<String>>read(body(get(partner, MINE + "/" + id + "/claims").expectStatus().isOk()),
				"$[*].organizationName"))
			.containsExactly("Wombat Team");
		assertProblem(get(lead, MINE + "/" + id + "/claims"), 404, "PERK_NOT_FOUND");
	}

	@Test
	void aCodeListGivesEachTeamACodeOfItsOwnUntilTheLastIsTaken() {
		String partner = owner("founder@bandicoot-perks.test", "Bandicoot Cloud");
		Map<String, Object> vouchers = perk("Bandicoot vouchers");
		vouchers.put("way", "codes");
		vouchers.put("url", null);
		String created = body(post(operator, ADMIN, admin(organizationOf(partner), vouchers)).expectStatus().isCreated());
		UUID id = idOf(created);
		String slug = slugOf(created);
		String codes = ADMIN + "/" + id + "/codes";

		// A list is published once it holds codes, which only an operator loads.
		assertProblem(post(operator, ADMIN + "/" + id + "/publish", null), 400, "PERK_INCOMPLETE");
		assertProblem(post(partner, codes, Map.of("codes", List.of("B-1"))), 403, "IDENTITY_OPERATOR_REQUIRED");
		String loaded = body(post(operator, codes, Map.of("codes", List.of("B-1", " B-2 ", "B-1"))).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(loaded, "$.added")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(loaded, "$.free")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(body(post(operator, codes, Map.of("codes", List.of("B-2")))
			.expectStatus()
			.isOk()), "$.added")).isZero();
		post(operator, ADMIN + "/" + id + "/publish", null).expectStatus().isOk();
		UUID link = idOf(body(post(operator, ADMIN, admin(organizationOf(partner), perk("Bandicoot site")))
			.expectStatus()
			.isCreated()));
		assertProblem(post(operator, ADMIN + "/" + link + "/codes", Map.of("codes", List.of("B-3"))), 409,
				"PERK_NOT_A_CODE_LIST");

		// Each team gets a code of its own, the first loaded first, until none is left.
		String first = owner("lead@bettong-team.test", "Bettong Team");
		String second = owner("lead@potoroo-team.test", "Potoroo Team");
		String third = owner("lead@quoll-team.test", "Quoll Team");
		assertThat(JsonPath.<String>read(body(claim(first, slug, Map.of()).expectStatus().isCreated()), "$.code"))
			.isEqualTo("B-1");
		assertThat(JsonPath.<String>read(body(claim(second, slug, Map.of()).expectStatus().isCreated()), "$.code"))
			.isEqualTo("B-2");
		assertProblem(claim(third, slug, Map.of()), 409, "PERK_NO_PLACES_LEFT");
		String page = body(get(third, PERKS + "/" + slug).expectStatus().isOk());
		assertThat(JsonPath.<String>read(page, "$.card.standing")).isEqualTo("full");
		assertThat(JsonPath.<Integer>read(page, "$.placesLeft")).isZero();
		assertThat(jdbc.sql("""
				select details ->> 'count' from audit_event where action = 'perk.codes_load' and resource_id = ?
				order by occurred_at
				""").param(id.toString()).query(String.class).list()).containsExactly("2", "0");
	}

	@Test
	void aRequestWaitsForThePartnerWhoseAnswerIsEmailedAndADeclineGivesThePlaceBack() {
		String partner = owner("founder@quokka-perks.test", "Quokka Consulting");
		Map<String, Object> assessment = perk("Readiness assessment");
		assessment.put("way", "request");
		assessment.put("url", null);
		assessment.put("places", 1);
		assessment.put("questions", List.of(question("What should we assess?", true, true),
				question("Your website", false, false)));
		String created = body(post(partner, MINE, assessment).expectStatus().isCreated());
		UUID id = idOf(created);
		String slug = slugOf(created);
		List<String> questions = JsonPath.read(created, "$.questions[*].id");
		post(partner, MINE + "/" + id + "/publish", null).expectStatus().isOk();

		// A request answers what is required, and nothing it does not ask.
		String fintrace = owner("lead@fintrace-team.test", "Fintrace");
		assertProblem(claim(fintrace, slug, Map.of()), 400, "PERK_ANSWERS_NOT_VALID");
		assertProblem(claim(fintrace, slug, Map.of(questions.get(0), "Claims", "elsewhere", "x")), 400,
				"PERK_ANSWERS_NOT_VALID");
		String sent = body(claim(fintrace, slug, Map.of(questions.get(0), "Our claims flow")).expectStatus().isCreated());
		assertThat(JsonPath.<String>read(sent, "$.state")).isEqualTo("waiting");
		assertThat(mail.latestSubjectTo("founder@quokka-perks.test"))
			.isEqualTo("A request for Readiness assessment waits for you");
		assertThat(mail.latestTextTo("founder@quokka-perks.test")).contains("Fintrace")
			.containsPattern("https?://[^/ ]+/workspace/organization/perks/" + id);

		// A waiting request holds the one place.
		String bilby = owner("lead@bilby-team.test", "Bilby");
		assertProblem(claim(bilby, slug, Map.of(questions.get(0), "Our underwriting")), 409, "PERK_NO_PLACES_LEFT");

		// The partner reads the answers and declines; the person who asked is told, and the place is free again.
		String rows = body(get(partner, MINE + "/" + id + "/claims").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(rows, "$[*].answers['" + questions.get(0) + "']"))
			.containsExactly("Our claims flow");
		UUID request = UUID.fromString(JsonPath.<List<String>>read(rows, "$[*].id").get(0));
		long version = JsonPath.<List<Number>>read(rows, "$[*].version").get(0).longValue();
		String decision = MINE + "/" + id + "/claims/" + request;
		assertProblem(put(bilby, decision, Map.of("granted", false, "version", version)), 404, "PERK_NOT_FOUND");
		String declined = body(put(partner, decision, Map.of("granted", false, "version", version)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(declined, "$.state")).isEqualTo("declined");
		assertThat(mail.latestSubjectTo("lead@fintrace-team.test")).isEqualTo("Your request for Readiness assessment");
		assertProblem(put(partner, decision, Map.of("granted", true, "version", version + 1)), 409,
				"PERK_REQUEST_DECIDED");
		// A team that was declined holds that answer; it does not ask again.
		assertThat(JsonPath.<String>read(body(claim(fintrace, slug, Map.of(questions.get(0), "Again"))
			.expectStatus()
			.isCreated()), "$.state")).isEqualTo("declined");

		String asked = body(claim(bilby, slug, Map.of(questions.get(0), "Our underwriting", questions.get(1),
				"https://bilby.example.test")).expectStatus().isCreated());
		rows = body(get(operator, ADMIN + "/" + id + "/claims").expectStatus().isOk());
		version = JsonPath.<List<Number>>read(rows, "$[?(@.id == '" + idOf(asked) + "')].version").get(0).longValue();
		put(partner, MINE + "/" + id + "/claims/" + idOf(asked), Map.of("granted", true, "version", version))
			.expectStatus()
			.isOk();
		assertThat(mail.latestSubjectTo("lead@bilby-team.test"))
			.isEqualTo("Quokka Consulting granted your request for Readiness assessment");
		assertThat(JsonPath.<List<String>>read(body(get(bilby, "/api/perk/claims").expectStatus().isOk()),
				"$[*].claim.state"))
			.containsExactly("granted");

		// The partner downloads the claims with a column for each question, and the download is recorded.
		String csv = body(get(partner, MINE + "/" + id + "/claims/export?format=csv").expectStatus().isOk());
		assertThat(csv).contains("What should we assess?", "Our underwriting", "Our claims flow");
		assertThat(jdbc.sql("""
				select details ->> 'count' from audit_event where action = 'perk.claims_export' and resource_id = ?
				""").param(id.toString()).query(String.class).list()).containsExactly("2");
	}

	@Test
	void aRequestWithoutApprovalIsGrantedAsItIsSentAndOncePerPersonEachMemberGetsTheirOwn() {
		String partner = owner("founder@numbat-perks.test", "Numbat Plans");
		Map<String, Object> plan = perk("Numbat personal plan");
		plan.put("way", "request");
		plan.put("url", null);
		plan.put("requireApproval", false);
		plan.put("perPerson", true);
		String created = body(post(partner, MINE, plan).expectStatus().isCreated());
		String slug = slugOf(created);
		post(partner, MINE + "/" + idOf(created) + "/publish", null).expectStatus().isOk();

		String lead = owner("lead@dibbler-team.test", "Dibbler Team");
		String colleague = colleague(lead, "two@dibbler-team.test");
		String mine = body(claim(lead, slug, Map.of()).expectStatus().isCreated());
		assertThat(JsonPath.<String>read(mine, "$.state")).isEqualTo("granted");
		assertThat(JsonPath.<String>read(mine, "$.decidedAt")).isNotBlank();
		String theirs = body(claim(colleague, slug, Map.of()).expectStatus().isCreated());
		assertThat(idOf(theirs)).isNotEqualTo(idOf(mine));
		assertThat(idOf(body(claim(lead, slug, Map.of()).expectStatus().isCreated()))).isEqualTo(idOf(mine));
		// Nothing waits, so the partner is not asked.
		assertThat(mail.subjectsTo("founder@numbat-perks.test")).noneMatch(subject -> subject.contains("waits for you"));
	}

	@Test
	void aPerkShowsBetweenItsDatesAndAnEndedOneIsListedOnlyWhenAsked() {
		String partner = owner("founder@dingo-perks.test", "Dingo Cloud");
		Map<String, Object> ended = perk("Dingo summer credits");
		ended.put("endsAt", Instant.now().minus(Duration.ofDays(1)).toString());
		Map<String, Object> coming = perk("Dingo winter credits");
		coming.put("startsAt", Instant.now().plus(Duration.ofDays(1)).toString());
		Map<String, Object> backwards = perk("Dingo backwards credits");
		backwards.put("startsAt", Instant.now().plus(Duration.ofDays(2)).toString());
		backwards.put("endsAt", Instant.now().plus(Duration.ofDays(1)).toString());
		assertProblem(post(partner, MINE, backwards), 400, "PERK_DATES_NOT_VALID");
		String summer = body(post(partner, MINE, ended).expectStatus().isCreated());
		String winter = body(post(partner, MINE, coming).expectStatus().isCreated());
		post(partner, MINE + "/" + idOf(summer) + "/publish", null).expectStatus().isOk();
		post(partner, MINE + "/" + idOf(winter) + "/publish", null).expectStatus().isOk();

		String member = owner("lead@dingo-team.test", "Dingo Team");
		assertThat(catalogue(member, false)).doesNotContain(slugOf(summer), slugOf(winter));
		assertThat(catalogue(member, true)).contains(slugOf(summer)).doesNotContain(slugOf(winter));
		assertThat(standing(member, slugOf(summer))).isEqualTo("ended");
		assertThat(standing(member, slugOf(winter))).isEqualTo("not_started");
		assertProblem(claim(member, slugOf(summer), Map.of()), 409, "PERK_NOT_AVAILABLE");
		assertProblem(claim(member, slugOf(winter), Map.of()), 409, "PERK_NOT_AVAILABLE");
	}

	@Test
	void aPerkForAProgramsTeamsNamesAProgramThatExists() {
		String partner = owner("founder@echidna-perks.test", "Echidna Cloud");
		Map<String, Object> forApplicants = perk("Echidna credits for applicants");
		forApplicants.put("audience", "applicants");
		assertProblem(post(partner, MINE, forApplicants), 400, "PERK_PROGRAM_NOT_FOUND");
		forApplicants.put("programId", UUID.randomUUID());
		assertProblem(post(partner, MINE, forApplicants), 400, "PERK_PROGRAM_NOT_FOUND");
		assertProblem(post(operator, ADMIN, Map.of("organizationId", organizationOf(partner), "perk",
				perk("Echidna placed nowhere"), "fromGenAiFund", false, "shownOnProgramIds", List.of(UUID.randomUUID()))),
				400, "PERK_PROGRAM_NOT_FOUND");
	}

	/** A perk as its form sends it: a link for members, with nothing else filled in. */
	private static Map<String, Object> perk(String title) {
		Map<String, Object> perk = new HashMap<>();
		perk.put("title", title);
		perk.put("value", null);
		perk.put("summary", null);
		perk.put("about", null);
		perk.put("steps", List.of("Open the partner's page.", "Sign up with your work address."));
		perk.put("terms", null);
		perk.put("termsUrl", null);
		perk.put("audience", "members");
		perk.put("programId", null);
		perk.put("way", "link");
		perk.put("url", "https://perks.example.test/" + PerkViews.slug(title));
		perk.put("code", null);
		perk.put("redeemUrl", null);
		perk.put("questions", List.of());
		perk.put("requireApproval", true);
		perk.put("perPerson", false);
		perk.put("places", null);
		perk.put("startsAt", null);
		perk.put("endsAt", null);
		perk.put("solutionIds", List.of());
		perk.put("version", null);
		return perk;
	}

	private static Map<String, Object> question(String label, boolean multiline, boolean required) {
		return Map.of("label", label, "multiline", multiline, "required", required);
	}

	/** An operator's form for the perk, GenAI Fund's mark set. */
	private static Map<String, Object> admin(@Nullable UUID organization, Map<String, Object> perk) {
		Map<String, Object> form = new HashMap<>();
		form.put("organizationId", organization);
		form.put("perk", perk);
		form.put("fromGenAiFund", true);
		form.put("shownOnProgramIds", List.of());
		return form;
	}

	/** The form with the version a read of the perk answered. */
	private static Map<String, Object> versioned(Map<String, Object> perk, String read) {
		Map<String, Object> form = new HashMap<>(perk);
		form.put("version", JsonPath.<Number>read(read, "$.version").longValue());
		return form;
	}

	private RestTestClient.ResponseSpec claim(String session, String slug, Map<String, String> answers) {
		return post(session, PERKS + "/" + slug + "/claims", Map.of("answers", answers));
	}

	private String standing(String session, String slug) {
		return JsonPath.read(body(get(session, PERKS + "/" + slug).expectStatus().isOk()), "$.card.standing");
	}

	/** The addresses of the perks in the catalogue as the caller reads it; null for a visitor. */
	private List<String> catalogue(@Nullable String session, boolean ended) {
		String path = PERKS + "?ended=" + ended;
		String read = session == null ? body(client.get().uri(path).exchange().expectStatus().isOk())
				: body(get(session, path).expectStatus().isOk());
		return JsonPath.read(read, "$[*].slug");
	}

	/** The titles of the perks the solution's card shows. */
	private List<String> lines(UUID solution) {
		return JsonPath.read(body(client.get().uri("/api/perk/solutions?ids=" + solution).exchange().expectStatus().isOk()),
				"$[?(@.solutionId == '" + solution + "')].perks[*].title");
	}

	private List<String> events(UUID perk) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'perk' and resource_id = ?
				order by occurred_at, id
				""").param(perk.toString()).query(String.class).list();
	}

	private UUID solution(String session, String name) {
		return idOf(body(post(session, "/api/solution/mine", Map.of("name", name)).expectStatus().isCreated()));
	}

	private static UUID idOf(String read) {
		return UUID.fromString(JsonPath.read(read, "$.id"));
	}

	private static String slugOf(String read) {
		return JsonPath.read(read, "$.slug");
	}

	private UUID organizationOf(String session) {
		return UUID.fromString(
				JsonPath.read(body(get(session, ORGANIZATION + "/mine").expectStatus().isOk()), "$.organization.id"));
	}

	/** The session of an owner of a new organization. */
	private String owner(String email, String name) {
		String session = signIn(email);
		post(session, ORGANIZATION + "/organizations", Map.of("name", name, "type", "company", "country", "VN",
				"teamSize", "2_9", "industries", List.of("insurance"), "website", "https://example.test", "description",
				"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated();
		return session;
	}

	/** The session of someone the owner invited to the organization, who accepted. */
	private String colleague(String owner, String email) {
		String session = signIn(email);
		post(owner, ORGANIZATION + "/mine/invitations", Map.of("email", email, "role", "member"))
			.expectStatus()
			.isNoContent();
		String invitation = JsonPath.read(body(get(session, ORGANIZATION + "/mine").expectStatus().isOk()),
				"$.invitations[0].id");
		post(session, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
		return session;
	}

	private RestTestClient.ResponseSpec get(String session, String path) {
		return client.get().uri(path).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private RestTestClient.ResponseSpec post(String session, String path, @Nullable Object body) {
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
