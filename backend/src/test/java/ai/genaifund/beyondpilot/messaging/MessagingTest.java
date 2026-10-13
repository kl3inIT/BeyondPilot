package ai.genaifund.beyondpilot.messaging;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import ai.genaifund.beyondpilot.storage.TestUploads;
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
import reactor.core.Disposable;

/**
 * Conversations over real HTTP against PostgreSQL: who may write to whom, that a first message waits until it is
 * answered, what each side reads, and what a screen that listens hears. Only the SMTP server is replaced. Each test
 * uses its own email domains, because a domain belongs to one organization.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, MessagingTest.Mail.class })
class MessagingTest {

	private static final String ORGANIZATION = "/api/organization";

	private static final String SOLUTION = "/api/solution";

	private static final String TALENT = "/api/talent";

	private static final String PROGRAMS = "/api/program/admin/programs";

	private static final String MESSAGING = "/api/messaging";

	private static final String CONVERSATIONS = MESSAGING + "/conversations";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private MessagingService messaging;

	@Autowired
	private MessagingClock clock;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = signIn("operator@genaifund.test");
	}

	@Test
	void aFirstMessageToAPersonWaitsUntilTheyAcceptAndThenBothWrite() {
		String talent = signIn("mei@first-talent.test");
		String slug = listedProfile(talent, "First Talent");
		String sender = signIn("minh@first-sender.test");

		String prospect = body(get(sender, MESSAGING + "/prospect?kind=talent&slug=" + slug).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(prospect, "$.conversationId")).isNull();
		assertThat(JsonPath.<Boolean>read(prospect, "$.request")).isTrue();
		assertThat(JsonPath.<String>read(prospect, "$.subject.headline")).isEqualTo("Builds claims AI");

		String started = body(start(sender, "talent", slug, "  Would you advise our team?  ").expectStatus().isOk());
		String id = JsonPath.read(started, "$.conversation.id");
		assertThat(JsonPath.<String>read(started, "$.conversation.status")).isEqualTo("pending");
		assertThat(JsonPath.<String>read(started, "$.conversation.side")).isEqualTo("starter");
		assertThat(JsonPath.<String>read(started, "$.conversation.counterpartName")).isEqualTo("First Talent");
		assertThat(JsonPath.<Boolean>read(started, "$.conversation.canWrite")).isFalse();
		assertThat(JsonPath.<List<String>>read(started, "$.messages[*].body")).containsExactly("Would you advise our team?");
		// The person is told by email, without the sender's address, and led to Messages.
		String text = mail.latestTextTo("mei@first-talent.test");
		assertThat(mail.latestSubjectTo("mei@first-talent.test")).isEqualTo("A first message for you on BeyondPilot");
		assertThat(text).contains("First Talent").doesNotContain("minh@first-sender.test");
		assertThat(text).containsPattern("https?://[^/ ]+/workspace/messages(?![\\w/-])");

		// It waits under the person's requests and under the sender's chats, and nobody writes in it yet.
		String theirs = body(get(talent, CONVERSATIONS).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(theirs, "$.requests[*].id")).containsExactly(id);
		assertThat(JsonPath.<List<Object>>read(theirs, "$.chats")).isEmpty();
		assertThat(JsonPath.<Boolean>read(theirs, "$.requests[0].canAnswer")).isTrue();
		assertThat(JsonPath.<Number>read(body(get(talent, MESSAGING + "/unread").expectStatus().isOk()), "$.requests")
			.intValue()).isEqualTo(1);
		assertThat(JsonPath.<List<String>>read(body(get(sender, CONVERSATIONS).expectStatus().isOk()), "$.chats[*].id"))
			.containsExactly(id);
		assertProblem(send(sender, id, "One more thing."), 409, "MESSAGING_NOT_OPEN");
		assertProblem(start(sender, "talent", slug, "Hello again."), 409, "MESSAGING_ALREADY_WAITING");
		assertThat(JsonPath.<String>read(
				body(get(sender, MESSAGING + "/prospect?kind=talent&slug=" + slug).expectStatus().isOk()),
				"$.conversationId")).isEqualTo(id);

		String accepted = body(post(talent, CONVERSATIONS + "/" + id + "/accept", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(accepted, "$.conversation.status")).isEqualTo("accepted");
		assertThat(JsonPath.<Boolean>read(accepted, "$.conversation.canWrite")).isTrue();
		assertThat(mail.latestSubjectTo("minh@first-sender.test")).isEqualTo("Your message was accepted");
		assertProblem(post(talent, CONVERSATIONS + "/" + id + "/accept", null), 409, "MESSAGING_NOT_WAITING");
		assertThat(events(id)).containsExactly("messaging.request_accept");

		// Both write; each reads what the other wrote as unread until they say they read it.
		String reply = body(send(talent, id, "Yes, gladly.").expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(reply, "$.mine")).isTrue();
		assertThat(JsonPath.<Boolean>read(reply, "$.fromStarter")).isFalse();
		long seq = JsonPath.<Number>read(reply, "$.seq").longValue();
		String sendersList = body(get(sender, CONVERSATIONS).expectStatus().isOk());
		assertThat(JsonPath.<Number>read(sendersList, "$.unread").intValue()).isEqualTo(1);
		assertThat(JsonPath.<String>read(sendersList, "$.chats[0].lastMessage.preview")).isEqualTo("Yes, gladly.");
		assertThat(JsonPath.<Boolean>read(sendersList, "$.chats[0].lastMessage.mine")).isFalse();
		post(sender, CONVERSATIONS + "/" + id + "/read", Map.of("seq", seq)).expectStatus().isNoContent();
		assertThat(JsonPath.<Number>read(body(get(sender, CONVERSATIONS).expectStatus().isOk()), "$.unread").intValue())
			.isZero();
		// The person who wrote sees how far the other side has read.
		assertThat(JsonPath.<Number>read(body(get(talent, CONVERSATIONS + "/" + id).expectStatus().isOk()),
				"$.readByOtherSide")
			.longValue()).isEqualTo(seq);
		// Writing to the person again goes into the open conversation.
		String again = body(start(sender, "talent", slug, "Shall we talk on Tuesday?").expectStatus().isOk());
		assertThat(JsonPath.<String>read(again, "$.conversation.id")).isEqualTo(id);
		assertThat(JsonPath.<List<String>>read(again, "$.messages[*].body")).containsExactly("Would you advise our team?",
				"Yes, gladly.", "Shall we talk on Tuesday?");
	}

	@Test
	void aMessageSentTwiceIsWrittenOnceAndAnotherPersonReadsNothing() {
		String talent = signIn("mei@twice-talent.test");
		String slug = listedProfile(talent, "Twice Talent");
		String sender = signIn("minh@twice-sender.test");
		String id = JsonPath.read(body(start(sender, "talent", slug, "Hello.").expectStatus().isOk()), "$.conversation.id");
		post(talent, CONVERSATIONS + "/" + id + "/accept", null).expectStatus().isOk();
		UUID message = UUID.randomUUID();
		Map<String, Object> request = Map.of("id", message.toString(), "body", "Only once.");

		String first = body(post(sender, CONVERSATIONS + "/" + id + "/messages", request).expectStatus().isOk());
		String second = body(post(sender, CONVERSATIONS + "/" + id + "/messages", request).expectStatus().isOk());

		assertThat(JsonPath.<Number>read(second, "$.seq").longValue())
			.isEqualTo(JsonPath.<Number>read(first, "$.seq").longValue());
		assertThat(JsonPath.<List<String>>read(body(get(talent, CONVERSATIONS + "/" + id).expectStatus().isOk()),
				"$.messages[*].body")).containsExactly("Hello.", "Only once.");
		// The identifier of a message is not taken by another person.
		assertProblem(post(talent, CONVERSATIONS + "/" + id + "/messages",
				Map.of("id", message.toString(), "body", "Mine now.")), 409, "MESSAGING_MESSAGE_CONFLICT");
		post(sender, CONVERSATIONS + "/" + id + "/messages", Map.of("id", UUID.randomUUID().toString(), "body", " "))
			.expectStatus()
			.isBadRequest();

		String stranger = signIn("stranger@twice-stranger.test");
		assertProblem(get(stranger, CONVERSATIONS + "/" + id), 404, "MESSAGING_CONVERSATION_NOT_FOUND");
		assertProblem(get(stranger, CONVERSATIONS + "/" + id + "/messages"), 404, "MESSAGING_CONVERSATION_NOT_FOUND");
		assertProblem(send(stranger, id, "Let me in."), 404, "MESSAGING_CONVERSATION_NOT_FOUND");
		assertProblem(post(stranger, CONVERSATIONS + "/" + id + "/read", Map.of("seq", 1)), 404,
				"MESSAGING_CONVERSATION_NOT_FOUND");
		assertThat(JsonPath.<List<Object>>read(body(get(stranger, CONVERSATIONS).expectStatus().isOk()), "$.chats"))
			.isEmpty();
	}

	@Test
	void aDeclineAndAReportReadTheSameToTheSenderWhoMayWriteAgain() {
		String talent = signIn("mei@decline-talent.test");
		String slug = listedProfile(talent, "Decline Talent");
		String sender = signIn("minh@decline-sender.test");
		String declined = JsonPath.read(body(start(sender, "talent", slug, "First try.").expectStatus().isOk()),
				"$.conversation.id");

		post(talent, CONVERSATIONS + "/" + declined + "/decline", null).expectStatus().isNoContent();

		assertThat(mail.latestSubjectTo("minh@decline-sender.test")).isEqualTo("Your message on BeyondPilot");
		// It is gone for the person, and reads as declined to the sender.
		assertProblem(get(talent, CONVERSATIONS + "/" + declined), 404, "MESSAGING_CONVERSATION_NOT_FOUND");
		assertThat(JsonPath.<String>read(body(get(sender, CONVERSATIONS + "/" + declined).expectStatus().isOk()),
				"$.conversation.status")).isEqualTo("declined");

		String reported = JsonPath.read(body(start(sender, "talent", slug, "Buy my course.").expectStatus().isOk()),
				"$.conversation.id");
		post(talent, CONVERSATIONS + "/" + reported + "/report", null).expectStatus().isNoContent();
		assertThat(JsonPath.<String>read(body(get(sender, CONVERSATIONS + "/" + reported).expectStatus().isOk()),
				"$.conversation.status")).isEqualTo("declined");
		assertThat(events(reported)).containsExactly("messaging.request_report");

		// Operators read what was reported, with who sent it, and nothing else.
		String list = body(get(operator, MESSAGING + "/admin/reported").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[?(@.id=='" + reported + "')].message"))
			.containsExactly("Buy my course.");
		assertThat(JsonPath.<List<String>>read(list, "$.items[?(@.id=='" + reported + "')].senderEmail"))
			.containsExactly("minh@decline-sender.test");
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].id")).doesNotContain(declined);
		assertProblem(get(sender, MESSAGING + "/admin/reported"), 403, "IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void aFirstMessageIsRefusedWhenItCannotBeWritten() {
		String talent = signIn("mei@refuse-talent.test");
		String slug = listedProfile(talent, "Refuse Talent");
		String provider = organizationOwner("owner@refuse-chat-provider.test", "Refuse Chat Provider");
		String solution = listedSolution(provider, "Refuse Chat Triage");
		String loner = signIn("loner@refuse-gmail.test");

		assertProblem(start(loner, "talent", "no-such-person", "Hello."), 404, "MESSAGING_SUBJECT_NOT_FOUND");
		assertProblem(start(talent, "talent", slug, "Hello me."), 409, "MESSAGING_OWN_SUBJECT");
		start(loner, "talent", slug, " ").expectStatus().isBadRequest();
		start(loner, "person", slug, "Hello.").expectStatus().isBadRequest();
		// A provider reads which organization asks.
		assertProblem(start(loner, "solution", solution, "Hello."), 403, "MESSAGING_NEEDS_ORGANIZATION");
		String waiting = signIn("waiting@refuse-chat-waiting.test");
		organization(waiting, "Refuse Chat Waiting");
		assertProblem(start(waiting, "solution", solution, "Hello."), 403, "MESSAGING_ORGANIZATION_NOT_APPROVED");
		assertProblem(start(provider, "solution", solution, "Hello us."), 409, "MESSAGING_OWN_SUBJECT");
		assertProblem(start(operator, "program", "no-such-program", "Hello."), 404, "MESSAGING_SUBJECT_NOT_FOUND");
	}

	@Test
	void aConversationWithAProviderBelongsToItsOrganizationAndItsOwnersAnswer() {
		String owner = signIn("owner@org-provider.test");
		UUID providerId = organization(owner, "Org Provider");
		post(operator, ORGANIZATION + "/admin/organizations/" + providerId + "/approve",
				Map.of("emailDomain", "org-provider.test"))
			.expectStatus()
			.isNoContent();
		put(owner, ORGANIZATION + "/mine/auto-join", Map.of("autoJoin", true)).expectStatus().isNoContent();
		String solution = listedSolution(owner, "Org Triage");
		String member = signIn("member@org-provider.test");
		post(member, ORGANIZATION + "/organizations/" + providerId + "/join", Map.of()).expectStatus().is2xxSuccessful();
		String buyer = organizationOwner("buyer@org-buyer.test", "Org Buyer");

		String started = body(start(buyer, "solution", solution, "Could you show us a demo?").expectStatus().isOk());
		String id = JsonPath.read(started, "$.conversation.id");
		assertThat(JsonPath.<String>read(started, "$.conversation.counterpartName")).isEqualTo("Org Provider");
		assertThat(JsonPath.<String>read(started, "$.subject.organizationName")).isEqualTo("Org Provider");
		assertThat(mail.latestTextTo("owner@org-provider.test")).contains("Org Buyer").contains("Org Triage");

		// A member reads the request and may not answer it; an owner does.
		String members = body(get(member, CONVERSATIONS).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(members, "$.requests[*].id")).containsExactly(id);
		assertThat(JsonPath.<Boolean>read(members, "$.requests[0].canAnswer")).isFalse();
		assertThat(JsonPath.<String>read(members, "$.requests[0].counterpartOrganization")).isEqualTo("Org Buyer");
		assertProblem(post(member, CONVERSATIONS + "/" + id + "/accept", null), 403, "MESSAGING_OWNERS_ONLY");
		post(owner, CONVERSATIONS + "/" + id + "/accept", null).expectStatus().isOk();

		// Then anyone of the organization writes, and each message names its writer.
		send(member, id, "Thursday at 10:00 works.").expectStatus().isOk();
		String read = body(get(buyer, CONVERSATIONS + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<List<Boolean>>read(read, "$.messages[*].fromStarter")).containsExactly(true, false);
		assertThat(JsonPath.<List<String>>read(read, "$.participants[*].role")).containsExactlyInAnyOrder("owner", "member");
		// What a colleague wrote is not unread for the organization's own people.
		assertThat(JsonPath.<Number>read(body(get(owner, CONVERSATIONS).expectStatus().isOk()), "$.unread").intValue())
			.isZero();
		assertThat(JsonPath.<Number>read(body(get(buyer, CONVERSATIONS).expectStatus().isOk()), "$.unread").intValue())
			.isEqualTo(1);
	}

	@Test
	void aSolutionLeftUnlistedIsStillWrittenToByItsAddress() {
		String provider = organizationOwner("owner@unlisted-provider.test", "Unlisted Provider");
		String slug = listedSolution(provider, "Unlisted Triage");
		String buyer = organizationOwner("buyer@unlisted-buyer.test", "Unlisted Buyer");
		UUID id = UUID.fromString(JsonPath
			.<List<String>>read(body(get(provider, SOLUTION + "/mine").expectStatus().isOk()),
					"$.items[?(@.name=='Unlisted Triage')].id")
			.get(0));
		String solution = body(get(provider, SOLUTION + "/mine/" + id).expectStatus().isOk());
		Map<String, Object> hidden = described("Unlisted Triage", JsonPath.<Number>read(solution, "$.version").longValue());
		hidden.put("listed", false);
		// A save keeps the images a reviewed solution has.
		hidden.put("logoFileId", JsonPath.<String>read(solution, "$.logo.fileId"));
		hidden.put("coverFileId", JsonPath.<String>read(solution, "$.cover.fileId"));
		put(provider, SOLUTION + "/mine/" + id, hidden).expectStatus().isOk();

		start(buyer, "solution", slug, "Hello.").expectStatus().isOk();
	}

	@Test
	void aConversationWithGenAiFundAboutAProgramIsOpenAtOnceForItsOperators() {
		String program = publishedProgram("Chat Program", "chat-program");
		String founder = signIn("founder@program-chat.test");

		String started = body(start(founder, "program", program, "Can one team apply twice?").expectStatus().isOk());
		String id = JsonPath.read(started, "$.conversation.id");
		assertThat(JsonPath.<String>read(started, "$.conversation.status")).isEqualTo("accepted");
		assertThat(JsonPath.<Object>read(started, "$.conversation.counterpartName")).isNull();
		assertThat(JsonPath.<List<Object>>read(started, "$.participants")).isEmpty();

		String operators = body(get(operator, CONVERSATIONS).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(operators, "$.chats[?(@.id=='" + id + "')].side"))
			.containsExactly("recipient");
		send(operator, id, "Yes, once for each solution.").expectStatus().isOk();
		assertThat(JsonPath.<List<String>>read(body(get(founder, CONVERSATIONS + "/" + id).expectStatus().isOk()),
				"$.messages[*].body")).containsExactly("Can one team apply twice?", "Yes, once for each solution.");
		// An operator answers for GenAI Fund and does not write to it.
		assertProblem(start(operator, "program", program, "Hello."), 409, "MESSAGING_OWN_SUBJECT");
	}

	@Test
	void aScreenThatListensHearsWhatIsWrittenReadAndTypedInItsConversationsOnly() {
		String talent = signIn("mei@live-talent.test");
		String slug = listedProfile(talent, "Live Talent");
		String sender = signIn("minh@live-sender.test");
		String id = JsonPath.read(body(start(sender, "talent", slug, "Hello.").expectStatus().isOk()), "$.conversation.id");
		post(talent, CONVERSATIONS + "/" + id + "/accept", null).expectStatus().isOk();
		signIn("stranger@live-stranger.test");
		List<MessagingEvent> heard = new CopyOnWriteArrayList<>();
		List<MessagingEvent> heardByStranger = new CopyOnWriteArrayList<>();
		Disposable listening = messaging.events(actor("minh@live-sender.test")).subscribe(heard::add);
		Disposable strangerListening = messaging.events(actor("stranger@live-stranger.test"))
			.subscribe(heardByStranger::add);
		try {
			post(talent, CONVERSATIONS + "/" + id + "/typing", null).expectStatus().isNoContent();
			String reply = body(send(talent, id, "Hello back.").expectStatus().isOk());
			long seq = JsonPath.<Number>read(reply, "$.seq").longValue();
			post(sender, CONVERSATIONS + "/" + id + "/read", Map.of("seq", seq)).expectStatus().isNoContent();

			assertThat(heard).extracting(event -> event.kind().eventName()).containsExactly("typing", "message", "read");
			assertThat(heard.get(1).message()).isNotNull();
			assertThat(heard.get(1).message().body()).isEqualTo("Hello back.");
			assertThat(heard.get(1).message().mine()).isFalse();
			assertThat(heard.get(2).seq()).isEqualTo(seq);
			assertThat(heard.get(2).mine()).isTrue();
			assertThat(heardByStranger).isEmpty();
			// A person with a screen open is not emailed about what they hear.
			assertThat(sent("minh@live-sender.test", "message_unread")).isZero();
		}
		finally {
			listening.dispose();
			strangerListening.dispose();
		}
	}

	@Test
	void aPersonWithNoScreenOpenIsEmailedOnceUntilTheyRead() {
		String talent = signIn("mei@absent-talent.test");
		String slug = listedProfile(talent, "Absent Talent");
		String sender = signIn("minh@absent-sender.test");
		String id = JsonPath.read(body(start(sender, "talent", slug, "Hello.").expectStatus().isOk()), "$.conversation.id");
		post(talent, CONVERSATIONS + "/" + id + "/accept", null).expectStatus().isOk();

		send(talent, id, "One.").expectStatus().isOk();
		String second = body(send(talent, id, "Two.").expectStatus().isOk());

		assertThat(mail.latestSubjectTo("minh@absent-sender.test")).isEqualTo("A new message waits for you on BeyondPilot");
		assertThat(mail.latestTextTo("minh@absent-sender.test")).contains("Absent Talent").doesNotContain("One.");
		assertThat(sent("minh@absent-sender.test", "message_unread")).isEqualTo(1);
		// Once they have read, the next message they miss is told again.
		post(sender, CONVERSATIONS + "/" + id + "/read", Map.of("seq", JsonPath.<Number>read(second, "$.seq").longValue()))
			.expectStatus()
			.isNoContent();
		send(talent, id, "Three.").expectStatus().isOk();
		mail.latestSubjectTo("minh@absent-sender.test");
		assertThat(sent("minh@absent-sender.test", "message_unread")).isEqualTo(2);
	}

	@Test
	void aRequestNobodyAnswersIsRemindedOnceAndThenCloses() {
		String talent = signIn("mei@clock-talent.test");
		String slug = listedProfile(talent, "Clock Talent");
		String sender = signIn("minh@clock-sender.test");
		String id = JsonPath.read(body(start(sender, "talent", slug, "Hello.").expectStatus().isOk()), "$.conversation.id");
		Instant now = Instant.now();

		assertThat(clock.remind(now.plus(Duration.ofDays(6)))).isZero();
		clock.remind(now.plus(Duration.ofDays(8)));
		assertThat(mail.latestSubjectTo("mei@clock-talent.test")).isEqualTo("A first message still waits for your answer");
		clock.remind(now.plus(Duration.ofDays(9)));
		assertThat(sent("mei@clock-talent.test", "message_request_reminder")).isEqualTo(1);

		clock.close(now.plus(Duration.ofDays(15)));

		assertThat(mail.latestSubjectTo("minh@clock-sender.test")).isEqualTo("Your message on BeyondPilot was not answered");
		assertThat(JsonPath.<String>read(body(get(sender, CONVERSATIONS + "/" + id).expectStatus().isOk()),
				"$.conversation.status")).isEqualTo("closed");
		assertProblem(post(talent, CONVERSATIONS + "/" + id + "/accept", null), 404, "MESSAGING_CONVERSATION_NOT_FOUND");
		// The sender may write again.
		start(sender, "talent", slug, "Hello again.").expectStatus().isOk();
	}

	@Test
	void aPersonStartsOnlySoManyConversationsInADay() {
		String sender = signIn("minh@limit-sender.test");
		for (int index = 0; index < MessagingService.STARTS_A_DAY; index++) {
			String slug = listedProfile(signIn("person" + index + "@limit-talent.test"), "Limit Talent " + index);
			start(sender, "talent", slug, "Hello.").expectStatus().isOk();
		}
		String oneMore = listedProfile(signIn("more@limit-talent.test"), "Limit Talent More");

		start(sender, "talent", oneMore, "Hello.").expectStatus()
			.isEqualTo(429)
			.expectHeader()
			.exists("Retry-After")
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("MESSAGING_TOO_MANY_REQUESTS");
	}

	@Test
	void everythingNeedsASession() {
		client.get().uri(CONVERSATIONS).exchange().expectStatus().isUnauthorized();
		client.get().uri(MESSAGING + "/unread").exchange().expectStatus().isUnauthorized();
		client.get().uri(MESSAGING + "/events").exchange().expectStatus().isUnauthorized();
		client.post()
			.uri(CONVERSATIONS)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("kind", "talent", "slug", "any", "body", "Hello."))
			.exchange()
			.expectStatus()
			.isUnauthorized();
	}

	private RestTestClient.ResponseSpec start(String session, String kind, String slug, String body) {
		return post(session, CONVERSATIONS, Map.of("kind", kind, "slug", slug, "body", body));
	}

	private RestTestClient.ResponseSpec send(String session, String conversation, String body) {
		return post(session, CONVERSATIONS + "/" + conversation + "/messages",
				Map.of("id", UUID.randomUUID().toString(), "body", body));
	}

	private Actor actor(String email) {
		return new Actor(jdbc.sql("select id from identity_account where email = ?").param(email).query(UUID.class).single());
	}

	/** How many emails of a kind were sent to an address, once everything queued has left. */
	private long sent(String recipient, String kind) {
		mail.countTo(recipient);
		return jdbc.sql("select count(*) from email_message where recipient = ? and kind = ?")
			.params(recipient, kind)
			.query(Long.class)
			.single();
	}

	/** Makes an approved profile in the directory and returns its address. */
	private String listedProfile(String session, String name) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("headline", "Builds claims AI");
		request.put("bio", "Ten years of machine learning in insurance.");
		request.put("roles", List.of("ml_engineer"));
		request.put("skills", List.of("Python"));
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
		request.put("version", null);
		put(session, TALENT + "/mine", request).expectStatus().isOk();
		String submitted = body(post(session, TALENT + "/mine/submit", null).expectStatus().isOk());
		post(operator, TALENT + "/admin/profiles/" + JsonPath.<String>read(submitted, "$.id") + "/approve", null)
			.expectStatus()
			.isNoContent();
		return JsonPath.read(body(get(session, TALENT + "/mine").expectStatus().isOk()), "$.profile.slug");
	}

	/** Makes a published program and returns its address. */
	private String publishedProgram(String name, String slug) {
		String created = body(post(operator, PROGRAMS, Map.of("name", name, "slug", slug, "type", "event")).expectStatus()
			.isCreated());
		String uri = PROGRAMS + "/" + JsonPath.<String>read(created, "$.id");
		UUID cover = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, 'program_image', true, 'cover.png', 'image/png', 2048, 'stored', id, now()
				from identity_account where email = 'operator@genaifund.test'
				""").params(cover, "test/" + cover).update();
		Map<String, Object> program = new LinkedHashMap<>();
		program.put("version", 0);
		program.put("name", name);
		program.put("slug", slug);
		program.put("type", "event");
		program.put("pageKind", "standard");
		program.put("keyDates", List.of());
		program.put("events", List.of());
		program.put("summary", "Insurers name what they need; providers answer.");
		program.put("coverFileId", cover);
		program.put("startsOn", "2026-09-23");
		program.put("endsOn", "2026-12-05");
		put(operator, uri, program).expectStatus().isOk();
		post(operator, uri + "/publish", null).expectStatus().isNoContent();
		return slug;
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
		request.put("builtWith", List.of());
		request.put("languages", List.of());
		request.put("deployment", List.of("cloud_saas"));
		request.put("website", "https://example.test");
		request.put("imageFileIds", List.of());
		request.put("offerIds", List.of());
		request.put("listed", true);
		request.put("version", version);
		return request;
	}

	private UUID organization(String session, String name) {
		return UUID.fromString(JsonPath.read(body(post(session, ORGANIZATION + "/organizations",
				Map.of("name", name, "type", "company", "country", "VN", "teamSize", "2_9", "industries",
						List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
	}

	/** The session of the owner of an approved organization. */
	private String organizationOwner(String email, String name) {
		String session = signIn(email);
		UUID organization = organization(session, name);
		post(operator, ORGANIZATION + "/admin/organizations/" + organization + "/approve", Map.of()).expectStatus()
			.isNoContent();
		return session;
	}

	/** Makes an approved, listed solution of the provider's organization and returns its address. */
	private String listedSolution(String provider, String name) {
		String draft = body(post(provider, SOLUTION + "/mine", Map.of("name", name)).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		Map<String, Object> request = described(name, JsonPath.<Number>read(draft, "$.version").longValue());
		// A review asks for a logo and a cover.
		request.put("logoFileId", TestUploads.image(client, provider, "solution_logo", "logo.png"));
		request.put("coverFileId", TestUploads.image(client, provider, "solution_image", "cover.png"));
		put(provider, SOLUTION + "/mine/" + id, request).expectStatus().isOk();
		post(provider, SOLUTION + "/mine/" + id + "/submit", null).expectStatus().isOk();
		post(operator, SOLUTION + "/admin/solutions/" + id + "/approve", Map.of()).expectStatus().isNoContent();
		return JsonPath.read(body(get(provider, SOLUTION + "/mine/" + id).expectStatus().isOk()), "$.slug");
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

	private List<String> events(String conversation) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'conversation' and resource_id = ?
				order by occurred_at, id
				""").param(conversation).query(String.class).list();
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
