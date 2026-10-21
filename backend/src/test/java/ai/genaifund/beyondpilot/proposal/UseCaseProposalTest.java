package ai.genaifund.beyondpilot.proposal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * An organization's proposal to a use case over real HTTP against PostgreSQL: who may send, a working copy saved by two
 * members, what sending needs and keeps, who reads what was sent, who sees the count, and what a merge does.
 */
class UseCaseProposalTest extends ApplicationsHttpTest {

	private static final String ORGANIZATION = "/api/organization";

	@LocalServerPort
	private int port;

	@Test
	void anApprovedOrganizationSendsAProposalAndThePostersReadIt() {
		Provider provider = provider("sends.test");
		Poster poster = poster("posts-sends.test");
		UUID useCase = publishedUseCase(poster.organization, "Voice-enabled navigation");
		String path = path(useCase);

		String empty = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(empty, "$.organization.active")).isTrue();
		assertThat(JsonPath.<String>read(empty, "$.useCase.title")).isEqualTo("Voice-enabled navigation");
		assertThat(JsonPath.<Object>read(empty, "$.proposal")).isNull();


		// A draft keeps whatever the form holds, and any member of the organization carries it on.
		String first = body(put(provider.founder, path, draft(provider.solution, "We adapt it.", null, null, null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(first, "$.proposal.status")).isEqualTo("draft");
		String id = JsonPath.read(first, "$.proposal.id");
		String teamed = body(put(provider.colleague,
				path, draft(provider.solution, "We adapt it to your onboarding flow.", file(provider.colleagueEmail), null,
						proposalVersion(first)))
			.expectStatus()
			.isOk());
		assertThat(proposalVersion(teamed)).isGreaterThan(proposalVersion(first));
		// A draft carries no sender profile, and an unreviewed solution shows no address.
		assertThat(JsonPath.<Object>read(teamed, "$.proposal.sender")).isNull();
		assertThat(JsonPath.<Object>read(teamed, "$.proposal.solutions[0].slug")).isNull();
		assertThat(JsonPath.<Object>read(teamed, "$.proposal.solutions[0].logoFileId")).isNull();
		// Whoever holds its key reads even a draft, with no session and nothing of the owners' editor.
		String viewKey = JsonPath.read(teamed, "$.proposal.solutions[0].viewKey");
		String shared = body(client.get().uri("/api/solution/solutions/shared/" + viewKey).exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(shared, "$.name")).isEqualTo("Claim Copilot");
		assertThat(JsonPath.<Boolean>read(shared, "$.approved")).isFalse();
		assertThat(shared).doesNotContain("decisionReason", "decisionMessage", "suspendedAt", "submittedBy", "\"status\"");
		client.get().uri("/api/solution/solutions/shared/" + UUID.randomUUID()).exchange().expectStatus().isNotFound();
		client.get().uri("/api/solution/solutions/shared/not-a-key").exchange().expectStatus().is4xxClientError();

		// A save made on a copy that another member has since changed is refused.
		assertProblem(put(provider.founder, path, draft(provider.solution, "Stale.", null, null, proposalVersion(first))),
				409, "PROPOSAL_CHANGED_MEANWHILE");

		// The sender is who the account says: a name, a country and a number come first.
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null), 400,
				"PROPOSAL_CONTACT_REQUIRED");
		reachable(provider.founder);
		String sent = body(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null).expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(sent, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentAt")).isNotNull();
		// The sender reads who sent it: the account's name, address, country and number.
		assertThat(JsonPath.<Object>read(sent, "$.proposal.sender")).isNull();
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentBy.name")).isEqualTo("Founder Provider");
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentBy.email")).isEqualTo(provider.founderEmail);
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentBy.country")).isEqualTo("VN");
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentBy.phone")).isEqualTo("+84 912 345 678");

		// The sender is told in an email of their own.
		assertThat(mail.latestSubjectTo(provider.founderEmail)).isEqualTo("Proposal sent: Voice-enabled navigation");
		assertThat(mail.latestTextTo(provider.founderEmail)).contains("/use-cases/" + useCase + "/propose/view")
			.doesNotContain("named on its team");

		// An approved solution carries its address, and its own logo when it has one.
		UUID logo = file(provider.founderEmail);
		jdbc.sql("update solution set status = 'approved', logo_file_id = ? where id = ?")
			.params(logo, provider.solution)
			.update();
		String approvedSolution = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(approvedSolution, "$.proposal.solutions[0].slug")).isNotBlank();
		assertThat(JsonPath.<String>read(approvedSolution, "$.proposal.solutions[0].logoFileId"))
			.isEqualTo(logo.toString());
		jdbc.sql("update solution set suspended_at = now() where id = ?").params(provider.solution).update();
		assertThat(JsonPath.<Object>read(body(get(provider.founder, path).expectStatus().isOk()),
				"$.proposal.solutions[0].slug")).isNull();

		// A sent proposal may be saved again while its time to edit lasts, if it stays complete; it cannot be sent again.
		assertProblem(put(provider.founder, path,
				draft(provider.solution, "Late.", null, null, proposalVersion(sent))), 400, "PROPOSAL_PDF_REQUIRED");
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null), 409,
				"PROPOSAL_ALREADY_SENT");

		// Anyone sees the count, with no session.
		String counts = body(client.get()
			.uri(API + "/use-case-proposal-counts?useCaseIds=" + useCase + "," + UUID.randomUUID())
			.exchange()
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<List<Integer>>read(counts, "$.items[*].received")).containsExactly(1, 0);

		// Every member of the posting organization reads it; nobody else does.
		for (String reader : List.of(poster.founder, poster.colleague)) {
			String list = body(get(reader, path + "s").expectStatus().isOk());
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].organizationName"))
				.containsExactly("Team sends.test");
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].organizationId"))
				.containsExactly(provider.organization().toString());
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].solutionNames[*]")).containsExactly("Claim Copilot");
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].contactName"))
				.hasSize(1);
		}
		String one = body(get(poster.colleague, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.approach")).isEqualTo("We adapt it to your onboarding flow.");
		assertThat(JsonPath.<String>read(one, "$.sentBy.email")).isEqualTo(provider.founderEmail);
		assertThat(JsonPath.<String>read(one, "$.sentBy.phone")).isEqualTo("+84 912 345 678");
		assertThat(JsonPath.<String>read(one, "$.deck.fileName")).isEqualTo("proposal.pdf");
		// An operator reads what any use case received; the PDF is theirs to read too.
		assertThat(JsonPath.<List<String>>read(body(get(operator, path + "s").expectStatus().isOk()),
				"$.items[*].organizationName")).containsExactly("Team sends.test");
		assertThat(JsonPath.<String>read(body(get(operator, API + "/use-case-proposals/" + id).expectStatus().isOk()),
				"$.sentBy.email")).isEqualTo(provider.founderEmail);
		// The PDF is answered as a PDF, which the viewer reads.
		get(operator, API + "/use-case-proposals/" + id + "/file").expectStatus().isOk().expectHeader()
			.contentType("application/pdf")
			.expectHeader()
			.valueMatches("Content-Disposition", "attachment; filename=\"proposal[.]pdf\".*");
		// The sender's own organization reads its PDF the same way, whoever of its members uploaded it; another one does not.
		get(provider.colleague, path + "/file").expectStatus().isOk().expectHeader()
			.contentType("application/pdf")
			.expectHeader()
			.valueMatches("Content-Disposition", "attachment; filename=\"proposal[.]pdf\".*");
		assertProblem(get(poster.founder, path + "/file"), 404, "PROPOSAL_NOT_FOUND");
		assertProblem(get(provider.founder, path + "s"), 404, "PROPOSAL_USE_CASE_NOT_FOUND");
		assertProblem(get(provider.founder, API + "/use-case-proposals/" + id), 404, "PROPOSAL_USE_CASE_NOT_FOUND");
		assertProblem(get(TestSignIn.session(client, mail, "stranger@nowhere.test"), path + "s"), 404,
				"PROPOSAL_USE_CASE_NOT_FOUND");

	}

	@Test
	void whoMaySendAndWhatAProposalNeeds() {
		Provider provider = provider("refuses.test");
		Poster poster = poster("posts-refuses.test");
		UUID useCase = publishedUseCase(poster.organization, "Refusals");
		String path = path(useCase);

		client.get().uri(path).exchange().expectStatus().isUnauthorized();
		String loner = TestSignIn.session(client, mail, "loner@nowhere.test");
		String lonerForm = body(get(loner, path).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(lonerForm, "$.organization")).isNull();
		assertProblem(put(loner, path, draft(null, null, null, null, null)), 403, "PROPOSAL_NO_ORGANIZATION");

		// An organization GenAI Fund took down works on a proposal like any other, and is shown as not active.
		Provider takenDown = provider("taken-down.test");
		jdbc.sql("update organization set suspended_at = now() where id = ?").params(takenDown.organization).update();
		assertThat(JsonPath.<Boolean>read(body(get(takenDown.founder, path).expectStatus().isOk()),
				"$.organization.active")).isFalse();
		put(takenDown.founder, path, draft(null, null, null, null, null)).expectStatus().isOk();

		assertProblem(get(poster.founder, path), 403, "PROPOSAL_OWN_USE_CASE");
		assertProblem(put(poster.founder, path, draft(null, null, null, null, null)), 403, "PROPOSAL_OWN_USE_CASE");

		assertProblem(put(provider.founder, path, draft(UUID.randomUUID(), null, null, null, null)), 400,
				"PROPOSAL_SOLUTION_NOT_FOUND");

		// Sending lists what is missing, one thing at a time.
		String saved = body(put(provider.founder, path, draft(null, null, null, null, null)).expectStatus().isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		String send = API + "/use-case-proposals/" + id + "/send";
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_SOLUTION_REQUIRED");
		String withSolution = body(put(provider.founder, path,
				draft(provider.solution, null, null, null, proposalVersion(saved))).expectStatus().isOk());
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_APPROACH_REQUIRED");
		String withApproach = body(put(provider.founder, path,
				draft(provider.solution, "Approach.", null, null, proposalVersion(withSolution))).expectStatus().isOk());
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_PDF_REQUIRED");
		put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail), null,
				proposalVersion(withApproach))).expectStatus().isOk();

		// A member of another organization cannot send it.
		assertProblem(post(takenDown.founder, send, null), 404, "PROPOSAL_NOT_FOUND");
		reachable(provider.founder);
		post(provider.founder, send, null).expectStatus().isOk();
	}

	@Test
	void aUseCaseThatClosedTakesNoProposals() {
		Provider provider = provider("closed.test");
		Poster poster = poster("posts-closed.test");
		UUID useCase = publishedUseCase(poster.organization, "Closing");
		String path = path(useCase);
		String saved = body(put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail), null, null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		reachable(provider.founder);

		jdbc.sql("update use_case set closes_at = now() - interval '1 minute' where id = ?").params(useCase).update();

		assertProblem(get(provider.founder, path), 409, "PROPOSAL_USE_CASE_CLOSED");
		assertProblem(put(provider.founder, path, draft(null, null, null, null, proposalVersion(saved))), 409,
				"PROPOSAL_USE_CASE_CLOSED");
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null), 409,
				"PROPOSAL_USE_CASE_CLOSED");
		assertProblem(get(provider.founder, API + "/use-cases/" + UUID.randomUUID() + "/proposal"), 404,
				"PROPOSAL_USE_CASE_NOT_FOUND");
		// What a closed use case received stays readable by those who posted it.
		get(poster.founder, path + "s").expectStatus().isOk();
	}

	@Test
	void aUseCaseInAChallengeTakingApplicationsIsAnsweredByApplyingUntilTheChallengeCloses() {
		Provider sender = provider("challenge-sent.test");
		Provider drafter = provider("challenge-draft.test");
		Provider newcomer = provider("challenge-new.test");
		Poster poster = poster("posts-challenge.test");
		UUID useCase = publishedUseCase(poster.organization, "Challenge brief");
		String path = path(useCase);
		String sent = body(put(sender.founder, path, draft(sender.solution, "Sent before.", file(sender.founderEmail), null, null))
			.expectStatus()
			.isOk());
		reachable(sender.founder);
		post(sender.founder, API + "/use-case-proposals/" + JsonPath.read(sent, "$.proposal.id") + "/send", null)
			.expectStatus()
			.isOk();
		String drafted = body(put(drafter.founder, path, draft(drafter.solution, "Not sent.", file(drafter.founderEmail), null, null))
			.expectStatus()
			.isOk());
		reachable(drafter.founder);

		Form challenge = program("use-case-challenge", false, Instant.now().plus(10, ChronoUnit.DAYS));
		put(operator, "/api/usecase/admin/use-cases/" + useCase + "/programs",
				Map.of("programIds", List.of(challenge.programId()))).expectStatus().isOk();

		// The brief names the challenge, whose application answers it.
		String brief = body(get(newcomer.founder, "/api/usecase/use-cases/" + useCase).expectStatus().isOk());
		assertThat(JsonPath.<String>read(brief, "$.challenge.slug")).isEqualTo("use-case-challenge");
		// No new proposal is made or sent; the one sent before stays readable.
		assertProblem(get(newcomer.founder, path), 409, "PROPOSAL_USE_CASE_IN_CHALLENGE");
		assertProblem(put(newcomer.founder, path, draft(newcomer.solution, "After.", null, null, null)), 409,
				"PROPOSAL_USE_CASE_IN_CHALLENGE");
		assertProblem(post(drafter.founder, API + "/use-case-proposals/" + JsonPath.read(drafted, "$.proposal.id") + "/send",
				null), 409, "PROPOSAL_USE_CASE_IN_CHALLENGE");
		get(sender.founder, path).expectStatus().isOk();

		// Once the challenge closes, the use case takes proposals again under its own dates.
		jdbc.sql("update program set applications_open_at = now() - interval '2 days', applications_close_at = now() - interval '1 minute' where id = ?")
			.params(challenge.programId())
			.update();
		String reopened = body(get(newcomer.founder, "/api/usecase/use-cases/" + useCase).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(reopened, "$.challenge")).isNull();
		post(drafter.founder, API + "/use-case-proposals/" + JsonPath.read(drafted, "$.proposal.id") + "/send", null)
			.expectStatus()
			.isOk();
	}

	@Test
	void aSentProposalCanBeEditedWhileTheUseCaseAllowsItAndThePostersSeeIt() {
		Provider provider = provider("edits.test");
		Poster poster = poster("posts-edits.test");
		UUID useCase = publishedUseCase(poster.organization, "Editable proposals");
		String path = path(useCase);
		String id = sentProposal(provider, useCase);
		String sent = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(Instant.parse(JsonPath.read(sent, "$.proposal.editableUntil")))
			.isCloseTo(Instant.parse(JsonPath.read(sent, "$.proposal.sentAt")).plus(7, ChronoUnit.DAYS),
					within(1, ChronoUnit.SECONDS));
		assertThat(JsonPath.<Object>read(sent, "$.proposal.editedAt")).isNull();
		String before = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(before, "$.editedAt")).isNull();

		// A colleague edits it: it stays sent, keeps its sender and its sending time, and says when it was edited.
		String edited = body(put(provider.colleague, path,
				draft(provider.solution, "A sharper approach.", file(provider.colleagueEmail), null,
						proposalVersion(sent)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(edited, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<String>read(edited, "$.proposal.approach")).isEqualTo("A sharper approach.");
		assertThat(JsonPath.<String>read(edited, "$.proposal.sentAt")).isEqualTo(JsonPath.read(sent, "$.proposal.sentAt"));
		assertThat(JsonPath.<String>read(edited, "$.proposal.editedAt")).isNotNull();
		assertThat(JsonPath.<String>read(edited, "$.proposal.editableUntil")).isNotNull();
		assertThat(jdbc.sql("select sent_by_account_id from use_case_proposal where id = ?")
			.params(UUID.fromString(id))
			.query(UUID.class)
			.single()).isEqualTo(provider.founderId);

		// A save on a stale copy is still refused.
		assertProblem(put(provider.founder, path, draft(provider.solution, "Stale.", file(provider.founderEmail), null, proposalVersion(sent))), 409,
				"PROPOSAL_CHANGED_MEANWHILE");

		String read = body(get(poster.colleague, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.approach")).isEqualTo("A sharper approach.");
		assertThat(JsonPath.<String>read(read, "$.editedAt")).isNotNull();
		String list = body(get(poster.founder, path + "s").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].editedAt")).hasSize(1).doesNotContainNull();

		// An edit must stay as complete as sending demanded; the codes are the same.
		long version = proposalVersion(edited);
		assertProblem(put(provider.founder, path, draft(null, "Approach.", file(provider.founderEmail), null, version)), 400, "PROPOSAL_SOLUTION_REQUIRED");
		assertProblem(put(provider.founder, path, draft(provider.solution, " ", file(provider.founderEmail), null, version)), 400, "PROPOSAL_APPROACH_REQUIRED");
		assertProblem(put(provider.founder, path, draft(provider.solution, "Approach.", null, null, version)), 400, "PROPOSAL_PDF_REQUIRED");
		String unchanged = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(unchanged, "$.proposal.approach")).isEqualTo("A sharper approach.");
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null), 409,
				"PROPOSAL_ALREADY_SENT");
	}

	@Test
	void aSentProposalCannotBeEditedOnceItsTimeHasEnded() {
		Provider provider = provider("window.test");
		Poster poster = poster("posts-window.test");
		UUID useCase = publishedUseCase(poster.organization, "Window");
		String path = path(useCase);
		String id = sentProposal(provider, useCase);
		String sent = body(get(provider.founder, path).expectStatus().isOk());

		jdbc.sql("update use_case_proposal set sent_at = now() - interval '8 days' where id = ?")
			.params(UUID.fromString(id))
			.update();

		assertProblem(put(provider.founder, path, draft(provider.solution, "Too late.", file(provider.founderEmail), null, proposalVersion(sent))), 409,
				"PROPOSAL_EDIT_WINDOW_CLOSED");
		// It stays readable, as sent.
		String read = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<Object>read(read, "$.proposal.editableUntil")).isNull();
		String received = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(received, "$.editedAt")).isNull();
	}

	@Test
	void aSentProposalIsTakenBackAndMayBeSentAgain() {
		Provider provider = provider("withdraws.test");
		Poster poster = poster("posts-withdraws.test");
		UUID useCase = publishedUseCase(poster.organization, "Withdrawn proposals");
		String path = path(useCase);
		String id = sentProposal(provider, useCase);
		String withdraw = API + "/use-case-proposals/" + id + "/withdraw";
		assertThat(received(useCase)).isEqualTo(1);

		// Somebody of another organization cannot take it back; it is not found for them.
		Provider other = provider("withdraws-other.test");
		assertProblem(post(other.founder, withdraw, null), 404, "PROPOSAL_NOT_FOUND");

		// A member of the sending organization takes it back: it is a draft again with what it held, and says when.
		String back = body(post(provider.colleague, withdraw, null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(back, "$.proposal.status")).isEqualTo("draft");
		assertThat(JsonPath.<String>read(back, "$.proposal.withdrawnAt")).isNotNull();
		assertThat(JsonPath.<Object>read(back, "$.proposal.sentAt")).isNull();
		assertThat(JsonPath.<Object>read(back, "$.proposal.sentBy")).isNull();
		assertThat(JsonPath.<Object>read(back, "$.proposal.editableUntil")).isNull();
		assertThat(JsonPath.<String>read(back, "$.proposal.approach")).isEqualTo("We adapt it.");
		assertThat(JsonPath.<List<String>>read(back, "$.proposal.solutions[*].name")).hasSize(1);

		// The organization that posted the use case no longer reads it, and it no longer counts.
		assertThat(received(useCase)).isZero();
		assertThat(JsonPath.<List<String>>read(body(get(poster.founder, path + "s").expectStatus().isOk()),
				"$.items[*].organizationName")).isEmpty();
		assertProblem(get(poster.founder, API + "/use-case-proposals/" + id), 404, "PROPOSAL_NOT_FOUND");
		// Only a sent proposal is taken back.
		assertProblem(post(provider.founder, withdraw, null), 409, "PROPOSAL_NOT_SENT");

		// It is a draft: it is saved, and sent again, which clears the note and starts the time to edit again.
		String saved = body(put(provider.founder, path,
				draft(provider.solution, "A second try.", file(provider.founderEmail), null, proposalVersion(back)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(saved, "$.proposal.status")).isEqualTo("draft");
		assertThat(JsonPath.<String>read(saved, "$.proposal.withdrawnAt")).isNotNull();
		String again = body(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(again, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<Object>read(again, "$.proposal.withdrawnAt")).isNull();
		assertThat(JsonPath.<String>read(again, "$.proposal.editableUntil")).isNotNull();
		assertThat(received(useCase)).isEqualTo(1);
		assertThat(JsonPath.<String>read(
				body(get(poster.colleague, API + "/use-case-proposals/" + id).expectStatus().isOk()), "$.approach"))
			.isEqualTo("A second try.");
	}

	@Test
	void aProposalCannotBeTakenBackOnceTheUseCaseClosedButStaysReadable() {
		Provider provider = provider("withdraws-closed.test");
		Poster poster = poster("posts-withdraws-closed.test");
		UUID useCase = publishedUseCase(poster.organization, "Closing after withdrawals");
		String path = path(useCase);
		String id = sentProposal(provider, useCase);
		Provider taken = provider("withdraws-taken.test");
		String takenId = sentProposal(taken, useCase);
		post(taken.founder, API + "/use-case-proposals/" + takenId + "/withdraw", null).expectStatus().isOk();

		jdbc.sql("update use_case set closes_at = now() - interval '1 minute' where id = ?").params(useCase).update();

		// The use case no longer takes proposals: a sent one stays, whatever the time to edit says.
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/withdraw", null), 409,
				"PROPOSAL_USE_CASE_CLOSED");
		assertThat(JsonPath.<String>read(body(get(provider.founder, path).expectStatus().isOk()), "$.proposal.status"))
			.isEqualTo("sent");
		// One taken back before the closing is still found, saying it was.
		String read = body(get(taken.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.proposal.status")).isEqualTo("draft");
		assertThat(JsonPath.<String>read(read, "$.proposal.withdrawnAt")).isNotNull();
		assertProblem(post(taken.founder, API + "/use-case-proposals/" + takenId + "/send", null), 409,
				"PROPOSAL_USE_CASE_CLOSED");
	}

	@Test
	void thePostingOrganizationAndOperatorsDecideOnProposalsAndNobodyIsTold() {
		Provider provider = provider("decides.test");
		Provider notSent = provider("decides-draft.test");
		Poster poster = poster("posts-decides.test");
		UUID useCase = publishedUseCase(poster.organization, "Decided proposals");
		String id = sentProposal(provider, useCase);
		String decide = API + "/use-case-proposals/" + id + "/decision";
		long mails = mail.countTo(provider.founderEmail);

		// Neither the provider, nor a stranger, nor another organization decides: the proposal is not found for them.
		assertProblem(post(provider.founder, decide, Map.of("decision", "shortlisted")), 404,
				"PROPOSAL_USE_CASE_NOT_FOUND");
		assertProblem(post(TestSignIn.session(client, mail, "stranger-decides@nowhere.test"), decide,
				Map.of("decision", "shortlisted")), 404, "PROPOSAL_USE_CASE_NOT_FOUND");
		// Only shortlisted or declined is a decision.
		assertProblem(post(poster.founder, decide, Map.of("decision", "maybe")), 400, "REQUEST_INVALID");
		// A proposal that was not sent cannot be decided.
		String draftId = JsonPath.read(body(put(notSent.founder, path(useCase),
				draft(notSent.solution, "Not yet.", null, null, null)).expectStatus().isOk()), "$.proposal.id");
		assertProblem(post(poster.founder, API + "/use-case-proposals/" + draftId + "/decision",
				Map.of("decision", "shortlisted")), 404, "PROPOSAL_NOT_FOUND");

		// Any member of the posting organization decides; the line says what, when and by whom.
		String first = body(post(poster.colleague, decide, Map.of("decision", "shortlisted")).expectStatus().isOk());
		assertThat(JsonPath.<String>read(first, "$.id")).isEqualTo(id);
		assertThat(JsonPath.<String>read(first, "$.decision")).isEqualTo("shortlisted");
		assertThat(JsonPath.<String>read(first, "$.decidedAt")).isNotNull();
		assertThat(JsonPath.<String>read(first, "$.decidedBy")).isNotBlank();
		assertThat(JsonPath.<Boolean>read(first, "$.outcomePending")).isTrue();
		assertThat(JsonPath.<Object>read(first, "$.outcomeSentAt")).isNull();

		// It changes freely, an operator may change it, and the same decision again adds nothing.
		String changed = body(post(operator, decide, Map.of("decision", "declined")).expectStatus().isOk());
		assertThat(JsonPath.<String>read(changed, "$.decision")).isEqualTo("declined");
		post(operator, decide, Map.of("decision", "declined")).expectStatus().isOk();
		post(poster.founder, decide, Map.of("decision", "shortlisted")).expectStatus().isOk();
		assertThat(jdbc.sql("select decision from use_case_proposal_decision where proposal_id = ? order by decided_at")
			.params(UUID.fromString(id))
			.query(String.class)
			.list()).containsExactly("shortlisted", "declined", "shortlisted");
		assertThat(jdbc.sql("select count(*) from audit_event where action = 'use_case_proposal.decide' and resource_id = ?")
			.params(id)
			.query(Long.class)
			.single()).isEqualTo(3L);

		// Deciding tells nobody.
		assertThat(mail.countTo(provider.founderEmail)).isEqualTo(mails);

		// The list and the detail carry the decision, and the counts for the tabs.
		String list = body(get(poster.founder, path(useCase) + "s").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(list, "$.shortlisted")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(list, "$.declined")).isZero();
		assertThat(JsonPath.<Integer>read(list, "$.pending")).isEqualTo(1);
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].decision")).containsExactly("shortlisted");
		String detail = body(get(operator, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(detail, "$.decision")).isEqualTo("shortlisted");
		assertThat(JsonPath.<Boolean>read(detail, "$.outcomePending")).isTrue();

		// A decision may change even after the use case closed.
		jdbc.sql("update use_case set closes_at = now() - interval '1 minute' where id = ?").params(useCase).update();
		post(poster.founder, decide, Map.of("decision", "declined")).expectStatus().isOk();
	}

	@Test
	void anOperatorsAppListsTheProposalsAUseCaseReceivedAndReadsOneWithItsDecision() {
		Provider provider = provider("mcp-proposals.test");
		Poster poster = poster("posts-mcp-proposals.test");
		UUID useCase = publishedUseCase(poster.organization, "Proposals read by an app");
		String id = sentProposal(provider, useCase);
		post(poster.founder, API + "/use-case-proposals/" + id + "/decision", Map.of("decision", "shortlisted"))
			.expectStatus()
			.isOk();

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

		String listed = text(app.callTool(McpSchema.CallToolRequest.builder("list_proposals")
			.arguments(Map.of("use_case", "use_case:" + useCase))
			.build()));
		assertThat(JsonPath.<Integer>read(listed, "$.received")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(listed, "$.shortlisted")).isEqualTo(1);
		assertThat(JsonPath.<String>read(listed, "$.proposals[0].id")).isEqualTo(id);
		assertThat(JsonPath.<String>read(listed, "$.proposals[0].decision")).isEqualTo("shortlisted");
		assertThat(JsonPath.<String>read(listed, "$.proposals[0].url"))
			.endsWith("/admin/use-cases/" + useCase + "/proposals/" + id);

		// Concise by default; the approach and the team come with detail.
		String brief = text(app.callTool(
				McpSchema.CallToolRequest.builder("get_proposal").arguments(Map.of("proposal", id)).build()));
		assertThat(JsonPath.<String>read(brief, "$.sentBy.email")).isEqualTo(provider.founderEmail);
		assertThat(JsonPath.<String>read(brief, "$.deck.name")).isNotBlank();
		assertThat(JsonPath.<Map<String, Object>>read(brief, "$")).doesNotContainKey("approach");
		String full = text(app.callTool(McpSchema.CallToolRequest.builder("get_proposal")
			.arguments(Map.of("proposal", id, "detail", true))
			.build()));
		assertThat(JsonPath.<String>read(full, "$.approach")).isEqualTo("We adapt it.");

		CallToolResult unknown = app.callTool(McpSchema.CallToolRequest.builder("get_proposal")
			.arguments(Map.of("proposal", UUID.randomUUID().toString()))
			.build());
		assertThat(unknown.isError()).isTrue();

		// The app decides it too, as the organization would; the same decision again changes nothing.
		String declined = text(app.callTool(McpSchema.CallToolRequest.builder("decide_proposal")
			.arguments(Map.of("proposal", id, "decision", "declined"))
			.build()));
		assertThat(JsonPath.<String>read(declined, "$.before")).isEqualTo("shortlisted");
		assertThat(JsonPath.<String>read(declined, "$.after")).isEqualTo("declined");
		assertThat(JsonPath.<String>read(declined, "$.url")).endsWith("/admin/use-cases/" + useCase + "/proposals/" + id);
		String again = text(app.callTool(McpSchema.CallToolRequest.builder("decide_proposal")
			.arguments(Map.of("proposal", id, "decision", "declined"))
			.build()));
		assertThat(JsonPath.<String>read(again, "$.before")).isEqualTo("declined");
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("decide_proposal")
			.arguments(Map.of("proposal", id, "decision", "accepted"))
			.build()).isError()).isTrue();
		app.closeGracefully();
		assertThat(jdbc.sql("select count(*) from use_case_proposal_decision where proposal_id = ?::uuid")
			.params(id)
			.query(Integer.class)
			.single()).isEqualTo(2);

		// The activity names what was read and links to it.
		assertThat(jdbc.sql("""
				select target_path from mcp_call where tool = 'get_proposal' and outcome = 'ok' and target_id = ?
				""").params(id).query(String.class).list())
			.hasSize(2)
			.allMatch(("/admin/use-cases/" + useCase + "/proposals/" + id)::equals);
	}

	private static String text(CallToolResult result) {
		assertThat(result.isError()).isFalse();
		return ((TextContent) result.content().getFirst()).text();
	}

	@Test
	void anOperatorDownloadsWhatAUseCaseReceivedAndTheDownloadIsRecorded() {
		Provider provider = provider("exports.test");
		Provider elsewhere = provider("exports-elsewhere.test");
		Poster poster = poster("posts-exports.test");
		UUID useCase = publishedUseCase(poster.organization, "Exported proposals");
		String id = sentProposal(provider, useCase);
		sentProposal(elsewhere, publishedUseCase(poster.organization, "Other proposals"));
		post(poster.founder, API + "/use-case-proposals/" + id + "/decision", Map.of("decision", "shortlisted"))
			.expectStatus()
			.isOk();
		String export = path(useCase) + "s/export";

		// The posting organization reads what it received but does not download it.
		assertProblem(post(poster.founder, export, null), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertThat(exportCounts(useCase)).isEmpty();

		List<List<String>> sheet = Workbooks.rows(post(operator, export, null).expectStatus()
			.isOk()
			.expectHeader()
			.contentType(SpreadsheetFormat.XLSX_TYPE)
			.expectHeader()
			.valueMatches("Content-Disposition", "attachment; filename=\"use-case-proposals-\\d{4}-\\d{2}-\\d{2}\\.xlsx\".*")
			.expectBody()
			.returnResult()
			.getResponseBody());
		assertThat(sheet).hasSize(3);
		assertThat(sheet.get(1)).startsWith("Proposal", "Organization", "Organization active", "Contact", "Solutions");
		assertThat(sheet.get(2)).startsWith(id, "Team exports.test", "Yes")
			.contains("Claim Copilot", "Shortlisted")
			.doesNotContain("Team exports-elsewhere.test");

		String csv = body(post(operator, export + "?format=csv", null).expectStatus()
			.isOk()
			.expectHeader()
			.contentType("text/csv;charset=UTF-8"));
		assertThat(csv).startsWith("\uFEFFProposal,Organization,Organization active,Contact,Solutions,Sent at,");
		assertThat(csv.lines().toList()).hasSize(2).last().asString().startsWith(id + ",Team exports.test,Yes,");
		assertThat(exportCounts(useCase)).containsExactly("1", "1");
	}

	private List<String> exportCounts(UUID useCase) {
		return jdbc.sql("""
				select details ->> 'count' from audit_event where action = 'use_case_proposal.export' and resource_id = ?
				order by occurred_at
				""").params(useCase.toString()).query(String.class).list();
	}

	@Test
	void outcomesAreEmailedOnceInABatchAndAgainOnlyWhenADecisionChanged() {
		Provider yes = provider("outcome-yes.test");
		Provider no = provider("outcome-no.test");
		Provider undecided = provider("outcome-undecided.test");
		Poster poster = poster("posts-outcomes.test");
		UUID useCase = publishedUseCase(poster.organization, "Outcomes use case");
		String send = API + "/use-cases/" + useCase + "/outcomes";
		String yesId = sentProposal(yes, useCase);
		String noId = sentProposal(no, useCase);
		sentProposal(undecided, useCase);

		// With nothing decided there is nothing to send.
		assertProblem(post(poster.founder, send, Map.of()), 409, "PROPOSAL_NOTHING_TO_SEND");
		post(poster.founder, API + "/use-case-proposals/" + yesId + "/decision", Map.of("decision", "shortlisted"))
			.expectStatus()
			.isOk();
		post(poster.colleague, API + "/use-case-proposals/" + noId + "/decision", Map.of("decision", "declined"))
			.expectStatus()
			.isOk();
		String before = body(get(poster.founder, path(useCase) + "s").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(before, "$.pending")).isEqualTo(2);

		// A provider does not send them.
		assertProblem(post(yes.founder, send, Map.of()), 404, "PROPOSAL_USE_CASE_NOT_FOUND");
		long yesMails = mail.countTo(yes.founderEmail);
		long noMails = mail.countTo(no.founderEmail);
		long undecidedMails = mail.countTo(undecided.founderEmail);
		assertProblem(post(poster.founder, send, Map.of("message", "x".repeat(2001))), 400, "REQUEST_INVALID");

		String sent = body(post(poster.colleague, send, Map.of("message", "Thank you all.")).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(sent, "$.sent")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(sent, "$.shortlisted")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(sent, "$.declined")).isEqualTo(1);
		assertThat(mail.countTo(yes.founderEmail)).isEqualTo(yesMails + 1);
		assertThat(mail.countTo(no.founderEmail)).isEqualTo(noMails + 1);
		assertThat(mail.countTo(undecided.founderEmail)).isEqualTo(undecidedMails);
		assertThat(mail.latestSubjectTo(yes.founderEmail)).isEqualTo("Shortlisted: Outcomes use case");
		assertThat(mail.latestTextTo(yes.founderEmail)).contains("Thank you all.")
			.contains("/use-cases/" + useCase + "/propose/view");
		assertThat(mail.latestSubjectTo(no.founderEmail)).isEqualTo("Your proposal for Outcomes use case");
		assertThat(mail.latestTextTo(no.founderEmail)).contains("Thank you all.");

		// Sent once: a second send finds nothing, and the list says so.
		assertProblem(post(poster.founder, send, Map.of()), 409, "PROPOSAL_NOTHING_TO_SEND");
		String after = body(get(poster.founder, path(useCase) + "s").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(after, "$.pending")).isZero();
		assertThat(JsonPath.<Integer>read(after, "$.shortlisted")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(after, "$.declined")).isEqualTo(1);
		assertThat(JsonPath.<List<Boolean>>read(after, "$.items[*].outcomePending")).containsOnly(false);
		assertThat(jdbc.sql("select count(*) from audit_event where action = 'use_case_proposal.outcomes_send' and resource_id = ?")
			.params(useCase.toString())
			.query(Long.class)
			.single()).isEqualTo(1L);

		// Deciding the same again leaves nothing to send; changing a decision is sent again, for that proposal only.
		post(poster.founder, API + "/use-case-proposals/" + yesId + "/decision", Map.of("decision", "shortlisted"))
			.expectStatus()
			.isOk();
		assertProblem(post(poster.founder, send, Map.of()), 409, "PROPOSAL_NOTHING_TO_SEND");
		post(poster.founder, API + "/use-case-proposals/" + yesId + "/decision", Map.of("decision", "declined"))
			.expectStatus()
			.isOk();
		assertThat(JsonPath.<Integer>read(body(get(poster.founder, path(useCase) + "s").expectStatus().isOk()),
				"$.pending")).isEqualTo(1);
		String again = body(post(poster.founder, send, Map.of()).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(again, "$.sent")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(again, "$.declined")).isEqualTo(1);
		assertThat(mail.countTo(yes.founderEmail)).isEqualTo(yesMails + 2);
		assertThat(mail.countTo(no.founderEmail)).isEqualTo(noMails + 1);
		assertThat(mail.latestSubjectTo(yes.founderEmail)).isEqualTo("Your proposal for Outcomes use case");
	}

	@Test
	void aProviderSeesTheOutcomeOnlyOnceItWasSentAndWithdrawingClearsIt() {
		Provider provider = provider("sees-outcome.test");
		Poster poster = poster("posts-sees-outcome.test");
		UUID useCase = publishedUseCase(poster.organization, "Visible outcomes");
		String path = path(useCase);
		String id = sentProposal(provider, useCase);
		String decide = API + "/use-case-proposals/" + id + "/decision";
		String send = API + "/use-cases/" + useCase + "/outcomes";

		assertThat(JsonPath.<Object>read(body(get(provider.founder, path).expectStatus().isOk()), "$.proposal.outcome"))
			.isNull();
		post(poster.founder, decide, Map.of("decision", "shortlisted")).expectStatus().isOk();
		// Decided, not told: the provider sees nothing.
		String hidden = body(get(provider.colleague, path).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(hidden, "$.proposal.outcome")).isNull();
		assertThat(JsonPath.<Object>read(hidden, "$.proposal.outcomeSentAt")).isNull();
		assertThat(hidden).doesNotContain("\"decision\"");

		post(poster.founder, send, Map.of()).expectStatus().isOk();
		String told = body(get(provider.colleague, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(told, "$.proposal.outcome")).isEqualTo("shortlisted");
		assertThat(JsonPath.<String>read(told, "$.proposal.outcomeSentAt")).isNotNull();

		// A change not yet sent stays hidden: the provider still reads what they were told.
		post(poster.founder, decide, Map.of("decision", "declined")).expectStatus().isOk();
		assertThat(JsonPath.<String>read(body(get(provider.founder, path).expectStatus().isOk()), "$.proposal.outcome"))
			.isEqualTo("shortlisted");

		// A shortlisted proposal can still be withdrawn: the decision and what was told go, the history stays.
		String back = body(post(provider.founder, API + "/use-case-proposals/" + id + "/withdraw", null).expectStatus()
			.isOk());
		assertThat(JsonPath.<Object>read(back, "$.proposal.outcome")).isNull();
		assertThat(JsonPath.<Object>read(back, "$.proposal.outcomeSentAt")).isNull();
		assertThat(jdbc.sql("select count(*) from use_case_proposal where id = ? and decision is null"
				+ " and decided_at is null and decided_by_account_id is null and outcome is null"
				+ " and outcome_sent_at is null")
			.params(UUID.fromString(id))
			.query(Long.class)
			.single()).isEqualTo(1L);
		assertThat(jdbc.sql("select count(*) from use_case_proposal_decision where proposal_id = ?")
			.params(UUID.fromString(id))
			.query(Long.class)
			.single()).isEqualTo(2L);
		// The poster no longer reads it, and sending again finds nothing.
		assertProblem(post(poster.founder, decide, Map.of("decision", "shortlisted")), 404, "PROPOSAL_NOT_FOUND");
		assertProblem(post(poster.founder, send, Map.of()), 409, "PROPOSAL_NOTHING_TO_SEND");
	}

	/** How many proposals the use case received, as anyone reads it. */
	private int received(UUID useCase) {
		String counts = body(client.get()
			.uri(API + "/use-case-proposal-counts?useCaseIds=" + useCase)
			.exchange()
			.expectStatus()
			.isOk());
		return JsonPath.<List<Integer>>read(counts, "$.items[*].received").get(0);
	}

	@Test
	void aUseCaseThatAllowsNoEditsKeepsASentProposalAsSent() {
		Provider provider = provider("nodays.test");
		Poster poster = poster("posts-nodays.test");
		UUID useCase = publishedUseCase(poster.organization, "No edits");
		jdbc.sql("update use_case set proposal_edit_days = 0 where id = ?").params(useCase).update();
		String path = path(useCase);
		sentProposal(provider, useCase);
		String sent = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(sent, "$.proposal.editableUntil")).isNull();

		assertProblem(put(provider.founder, path, draft(provider.solution, "Nope.", file(provider.founderEmail), null, proposalVersion(sent))), 409,
				"PROPOSAL_EDIT_WINDOW_CLOSED");
	}

	@Test
	void aSentProposalStaysReadableAfterTheUseCaseClosedButCannotBeEdited() {
		Provider provider = provider("closedview.test");
		Poster poster = poster("posts-closedview.test");
		UUID useCase = publishedUseCase(poster.organization, "Closing later");
		String path = path(useCase);
		sentProposal(provider, useCase);
		String sent = body(get(provider.founder, path).expectStatus().isOk());

		jdbc.sql("update use_case set closes_at = now() - interval '1 minute' where id = ?").params(useCase).update();

		String read = body(get(provider.colleague, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<String>read(read, "$.proposal.approach")).isEqualTo("We adapt it.");
		assertThat(JsonPath.<Object>read(read, "$.proposal.editableUntil")).isNull();
		assertProblem(put(provider.founder, path, draft(provider.solution, "After close.", file(provider.founderEmail), null, proposalVersion(sent))), 409,
				"PROPOSAL_EDIT_WINDOW_CLOSED");
		// An organization that sent nothing still finds the use case closed.
		Provider other = provider("closedview-other.test");
		assertProblem(get(other.founder, path), 409, "PROPOSAL_USE_CASE_CLOSED");
	}

	@Test
	void aPersonWithoutAnOrganizationMakesOneAndSendsWithoutWaitingForItsReview() {
		Poster poster = poster("posts-waiting.test");
		UUID useCase = publishedUseCase(poster.organization, "Claims triage");
		String path = path(useCase);

		// Someone in no organization makes one in this step: on their own, nobody reviews it before it sends.
		String loner = TestSignIn.session(client, mail, "alone@waiting-send.test");
		String made = body(post(loner, ORGANIZATION + "/organizations/basics", Map.of("name", "Alone Builder", "type",
				"independent_builder", "teamSize", "just_me", "industries", List.of(), "country", "VN"))
			.expectStatus()
			.isCreated());
		assertThat(JsonPath.<String>read(made, "$.name")).isEqualTo("Alone Builder");
		String form = body(get(loner, path).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(form, "$.organization.active")).isTrue();
		assertThat(JsonPath.<String>read(form, "$.organization.type")).isEqualTo("independent_builder");
		UUID solution = completeSolution(loner, "alone@waiting-send.test", "Lone Solver");
		String saved = body(put(loner, path, draft(solution, "Our approach.", file("alone@waiting-send.test"), null, null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		reachable(loner);
		String sent = body(post(loner, API + "/use-case-proposals/" + id + "/send", null).expectStatus().isOk());

		// It carries who sent it, and the poster sees it as pending.
		assertThat(JsonPath.<Object>read(sent, "$.proposal.sender")).isNull();
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentBy.email")).isEqualTo("alone@waiting-send.test");
		String list = body(get(poster.founder, path + "s").expectStatus().isOk());
		assertThat(JsonPath.<List<Boolean>>read(list, "$.items[*].organizationActive")).containsExactly(true);
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].contactName")).containsExactly("Founder Provider");
		String one = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(one, "$.organizationActive")).isTrue();
		assertThat(JsonPath.<String>read(one, "$.sentBy.email")).isEqualTo("alone@waiting-send.test");
		assertThat(JsonPath.<Object>read(one, "$.teamBackground")).isNull();
	}

	@Test
	void aTeamSaysWhatItHasDoneBeforeItSends() {
		Poster poster = poster("posts-team.test");
		UUID useCase = publishedUseCase(poster.organization, "Document reading");
		String path = path(useCase);

		String lead = TestSignIn.session(client, mail, "lead@team-send.test");
        String made = body(post(lead, ORGANIZATION + "/organizations/basics", Map.of("name", "Doc Team", "type", "builder_team", "teamSize",
                "2_9", "industries", List.of(), "country", "VN", "description", "Built document assistants."))
			.expectStatus()
			.isCreated());
        assertThat(JsonPath.<String>read(made, "$.description")).isEqualTo("Built document assistants.");
        assertThat(JsonPath.<String>read(body(get(lead, path).expectStatus().isOk()), "$.organization.type"))
            .isEqualTo("builder_team");
        assertThat(JsonPath.<Object>read(body(get(lead, path).expectStatus().isOk()), "$.organization.teamBackground"))
            .isNull();
		UUID solution = completeSolution(lead, "lead@team-send.test", "Doc Reader");
		String saved = body(put(lead, path, draft(solution, "Our approach.", file("lead@team-send.test"), null, null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		reachable(lead);
		String send = API + "/use-case-proposals/" + id + "/send";
		assertProblem(post(lead, send, null), 400, "PROPOSAL_TEAM_BACKGROUND_REQUIRED");

		String written = body(put(lead, path, draft(solution, "Our approach.", file("lead@team-send.test"),
				" Four years of document AI in banks. ", proposalVersion(saved)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(written, "$.proposal.teamBackground"))
			.isEqualTo("Four years of document AI in banks.");
		post(lead, send, null).expectStatus().isOk();
		String one = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.teamBackground")).isEqualTo("Four years of document AI in banks.");
	}

	/** Saves a complete proposal as the founder, completes the founder's profile and sends it; returns its id. */
	private String sentProposal(Provider provider, UUID useCase) {
		String saved = body(put(provider.founder, path(useCase), draft(provider.solution, "We adapt it.",
				file(provider.founderEmail), null, null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		reachable(provider.founder);
		post(provider.founder, API + "/use-case-proposals/" + id + "/send", null).expectStatus().isOk();
		return id;
	}

	@Test
	void aMergeGivesTheProposalsToTheOrganizationKept() {
		Provider duplicate = provider("dup-merge.test");
		Provider kept = provider("kept-merge.test");
		Poster poster = poster("posts-merge.test");
		UUID first = publishedUseCase(poster.organization, "Both have one");
		UUID second = publishedUseCase(poster.organization, "Only the duplicate has one");
		reachable(duplicate.founder);
		for (UUID useCase : List.of(first, second)) {
			String saved = body(put(duplicate.founder, path(useCase), draft(duplicate.solution, "Approach.",
					file(duplicate.founderEmail), null, null))
				.expectStatus()
				.isOk());
			if (useCase.equals(second)) {
				post(duplicate.founder, API + "/use-case-proposals/" + JsonPath.read(saved, "$.proposal.id") + "/send",
						null).expectStatus().isOk();
			}
		}
		put(kept.founder, path(first), draft(null, null, null, null, null)).expectStatus().isOk();

		post(operator, ORGANIZATION + "/admin/organizations/" + duplicate.organization + "/merge",
				Map.of("intoId", kept.organization)).expectStatus().isNoContent();

		List<UUID> ofKept = jdbc.sql("select use_case_id from use_case_proposal where organization_id = ? order by 1")
			.params(kept.organization)
			.query(UUID.class)
			.list();
		assertThat(ofKept).containsExactlyInAnyOrder(first, second);
		// The draft of the duplicate for the use case the kept one also has a proposal for is dropped.
		assertThat(jdbc.sql("select count(*) from use_case_proposal where organization_id = ?")
			.params(duplicate.organization)
			.query(Long.class)
			.single()).isZero();
	}

	@Test
	void aProposalOffersSeveralSolutionsWhateverTheirReview() {
		Provider provider = provider("offers.test");
		Poster poster = poster("posts-offers.test");
		String path = path(publishedUseCase(poster.organization, "Offers"));
		UUID bare = UUID.fromString(JsonPath.<String>read(
				body(post(provider.founder, "/api/solution/mine", Map.of("name", "Bare Desk")).expectStatus().isCreated()),
				"$.id"));
		UUID unknown = UUID.randomUUID();

		Map<String, Object> two = draft(provider.solution, "Both.", null, null, null);
		two.put("solutionIds", List.of(bare, provider.solution));
		String saved = body(put(provider.founder, path, two).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(saved, "$.proposal.solutions[*].name"))
			.containsExactly("Bare Desk", "Claim Copilot");
		assertThat(JsonPath.<List<String>>read(saved, "$.proposal.solutions[*].slug")).containsOnlyNulls();

		Map<String, Object> twice = draft(null, null, null, null, proposalVersion(saved));
		twice.put("solutionIds", List.of(bare, bare));
		assertProblem(put(provider.founder, path, twice), 400, "PROPOSAL_SOLUTION_NOT_FOUND");
		twice.put("solutionIds", List.of(unknown));
		assertProblem(put(provider.founder, path, twice), 400, "PROPOSAL_SOLUTION_NOT_FOUND");
	}

	/** An organization with a founder, a colleague and a complete solution. */
	private Provider provider(String domain) {
		String founder = TestSignIn.session(client, mail, "founder@" + domain);
		UUID organization = UUID.fromString(JsonPath.read(body(post(founder, ORGANIZATION + "/organizations",
				Map.of("name", "Team " + domain, "type", "company", "country", "VN", "teamSize", "2_9", "industries",
						List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
		String colleague = TestSignIn.session(client, mail, "colleague@" + domain);
		post(founder, ORGANIZATION + "/mine/invitations", Map.of("email", "colleague@" + domain, "role", "member"))
			.expectStatus()
			.isNoContent();
		String invitation = JsonPath.read(body(get(colleague, ORGANIZATION + "/mine").expectStatus().isOk()),
				"$.invitations[0].id");
		post(colleague, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
		UUID solution = completeSolution(founder, "founder@" + domain, "Claim Copilot");
		return new Provider(organization, founder, colleague, "founder@" + domain, "colleague@" + domain,
				accountOf("founder@" + domain), accountOf("colleague@" + domain), solution);
	}

	private Poster poster(String domain) {
		Provider organization = provider(domain);
		return new Poster(organization.organization, organization.founder, organization.colleague);
	}

	private UUID accountOf(String email) {
		return jdbc.sql("select id from identity_account where email = ?").params(email).query(UUID.class).single();
	}

	/** A use case an operator published for the organization, open for sixty days. */
	private UUID publishedUseCase(UUID organization, String title) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("organizationId", organization);
		body.put("publishNow", true);
		body.put("title", title);
		body.put("problemStatement", "Our service team checks vehicle documents by hand.");
		body.put("industry", "automotive_mobility");
		body.put("technologies", List.of("document_intelligence"));
		body.put("expectedOutcomes", "Cut hotline calls by 40%.");
		body.put("currentProcess", "Agents type dates into a spreadsheet.");
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
		body.put("hideOrganizationName", false);
		body.put("closesAt", Instant.now().plus(60, ChronoUnit.DAYS).toString());
		return UUID.fromString(JsonPath.read(
				body(post(operator, "/api/usecase/admin/use-cases", body).expectStatus().isCreated()), "$.id"));
	}

	private static String path(UUID useCase) {
		return API + "/use-cases/" + useCase + "/proposal";
	}

	private static Map<String, Object> draft(UUID solution, String approach, UUID deck, String teamBackground,
			Long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("solutionIds", solution == null ? List.of() : List.of(solution));
		request.put("approach", approach);
		request.put("deckFileId", deck);
		request.put("teamBackground", teamBackground);
		request.put("version", version);
		return request;
	}

	/** Gives the account the name, the country and the number a proposal is sent with. */
	private void reachable(String session) {
		put(session, "/api/identity/me/contact",
				Map.of("country", "VN", "phone", "+84 912 345 678", "name", "Founder Provider")).expectStatus().isOk();
	}

	private static long proposalVersion(String form) {
		return JsonPath.<Number>read(form, "$.proposal.version").longValue();
	}

	private record Provider(UUID organization, String founder, String colleague, String founderEmail,
			String colleagueEmail, UUID founderId, UUID colleagueId, UUID solution) {
	}

	private record Poster(UUID organization, String founder, String colleague) {
	}
}
