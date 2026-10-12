package ai.genaifund.beyondpilot.proposal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;

/**
 * An organization's proposal to a use case over real HTTP against PostgreSQL: who may send, a working copy saved by two
 * members, what sending needs and keeps, who reads what was sent, who sees the count, and what a merge does.
 */
class UseCaseProposalTest extends ApplicationsHttpTest {

	private static final String ORGANIZATION = "/api/organization";

	@Test
	void anApprovedOrganizationSendsAProposalAndThePostersReadIt() {
		Provider provider = provider("sends.test");
		Poster poster = poster("posts-sends.test");
		UUID useCase = publishedUseCase(poster.organization, "Voice-enabled navigation");
		String path = path(useCase);

		String empty = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(empty, "$.organization.approved")).isTrue();
		assertThat(JsonPath.<String>read(empty, "$.useCase.title")).isEqualTo("Voice-enabled navigation");
		assertThat(JsonPath.<Object>read(empty, "$.proposal")).isNull();
		assertThat(JsonPath.<List<String>>read(empty, "$.members[*].email"))
			.containsExactlyInAnyOrder("founder@sends.test", "colleague@sends.test");
		assertThat(JsonPath.<List<Boolean>>read(empty, "$.members[?(@.email=='founder@sends.test')].self"))
			.containsExactly(true);

		// A draft keeps whatever the form holds, and any member of the organization carries it on.
		String first = body(put(provider.founder, path, draft(provider.solution, "We adapt it.", null, List.of(), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(first, "$.proposal.status")).isEqualTo("draft");
		String id = JsonPath.read(first, "$.proposal.id");
		String teamed = body(put(provider.colleague,
				path, attached(draft(provider.solution, "We adapt it to your onboarding flow.", file(provider.colleagueEmail),
						List.of(member(provider.founderId, " Project lead ", true),
								member(provider.colleagueId, "AI engineer", false)),
						proposalVersion(first))))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<List<String>>read(teamed, "$.proposal.team[*].role")).containsExactly("Project lead",
				"AI engineer");
		assertThat(JsonPath.<List<Boolean>>read(teamed, "$.proposal.team[*].primary")).containsExactly(true, false);
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
		assertProblem(put(provider.founder, path, draft(provider.solution, "Stale.", null, List.of(), proposalVersion(first))),
				409, "PROPOSAL_CHANGED_MEANWHILE");

		// A proposal that attaches the sender's profile needs the sender to have one.
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null), 400,
				"PROPOSAL_PROFILE_INCOMPLETE");
		put(provider.founder, "/api/talent/mine", profile("Founder Provider")).expectStatus().isOk();
		String sent = body(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null).expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(sent, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentAt")).isNotNull();
		// The sender reads the profile as sent.
		assertThat(JsonPath.<String>read(sent, "$.proposal.sender.name")).isEqualTo("Founder Provider");
		assertThat(JsonPath.<String>read(sent, "$.proposal.sender.headline")).isEqualTo("Builds claims AI");
		assertThat(JsonPath.<List<String>>read(sent, "$.proposal.team[*].name")).hasSize(2);

		// The sender and each other member of the team are told, each in an email of their own with their role.
		assertThat(mail.latestSubjectTo(provider.founderEmail)).isEqualTo("Proposal sent: Voice-enabled navigation");
		assertThat(mail.latestTextTo(provider.founderEmail)).contains("Project lead", "and as the primary contact")
			.contains("/use-cases/" + useCase + "/propose/view")
			.doesNotContain("colleague@sends.test");
		assertThat(mail.latestTextTo(provider.colleagueEmail)).contains("AI engineer", "sent by founder@sends.test")
			.doesNotContain("and as the primary contact");

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
				draft(provider.solution, "Late.", null, List.of(), proposalVersion(sent))), 400, "PROPOSAL_PDF_REQUIRED");
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
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].solutionNames[*]")).containsExactly("Claim Copilot");
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].contactName"))
				.hasSize(1);
		}
		String one = body(get(poster.colleague, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.approach")).isEqualTo("We adapt it to your onboarding flow.");
		assertThat(JsonPath.<String>read(one, "$.sender.headline")).isEqualTo("Builds claims AI");
		assertThat(JsonPath.<String>read(one, "$.sender.email")).isEqualTo(provider.founderEmail);
		assertThat(JsonPath.<List<String>>read(one, "$.sender.skills")).containsExactly("Python", "LangGraph");
		assertThat(one).doesNotContain("rateBand");
		assertThat(JsonPath.<List<String>>read(one, "$.team[*].role")).containsExactly("Project lead", "AI engineer");
		assertThat(JsonPath.<String>read(one, "$.deck.fileName")).isEqualTo("proposal.pdf");
		// An operator reads what any use case received; the PDF is found for them (the test has no bytes behind it).
		assertThat(JsonPath.<List<String>>read(body(get(operator, path + "s").expectStatus().isOk()),
				"$.items[*].organizationName")).containsExactly("Team sends.test");
		assertThat(JsonPath.<String>read(body(get(operator, API + "/use-case-proposals/" + id).expectStatus().isOk()),
				"$.sender.headline")).isEqualTo("Builds claims AI");
		get(operator, API + "/use-case-proposals/" + id + "/file").expectStatus().value(status -> assertThat(status).isNotEqualTo(404));
		assertProblem(get(provider.founder, path + "s"), 404, "PROPOSAL_USE_CASE_NOT_FOUND");
		assertProblem(get(provider.founder, API + "/use-case-proposals/" + id), 404, "PROPOSAL_USE_CASE_NOT_FOUND");
		assertProblem(get(TestSignIn.session(client, mail, "stranger@nowhere.test"), path + "s"), 404,
				"PROPOSAL_USE_CASE_NOT_FOUND");

		// What the sender showed is kept as it was when the profile changes later.
		put(provider.founder, "/api/talent/mine", profile("Renamed Provider", profileVersion(provider.founder)))
			.expectStatus()
			.isOk();
		String again = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(again, "$.sender.name")).isEqualTo("Founder Provider");
	}

	@Test
	void whoMaySendAndWhatTheTeamMayName() {
		Provider provider = provider("refuses.test");
		Poster poster = poster("posts-refuses.test");
		UUID useCase = publishedUseCase(poster.organization, "Refusals");
		String path = path(useCase);

		client.get().uri(path).exchange().expectStatus().isUnauthorized();
		String loner = TestSignIn.session(client, mail, "loner@nowhere.test");
		String lonerForm = body(get(loner, path).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(lonerForm, "$.organization")).isNull();
		assertProblem(put(loner, path, draft(null, null, null, List.of(), null)), 403, "PROPOSAL_NO_ORGANIZATION");

		// An organization that waits for GenAI Fund's review works on a proposal like any other.
		Provider waiting = provider("waiting.test", false);
		assertThat(JsonPath.<Boolean>read(body(get(waiting.founder, path).expectStatus().isOk()),
				"$.organization.approved")).isFalse();
		put(waiting.founder, path, draft(null, null, null, List.of(), null)).expectStatus().isOk();

		assertProblem(get(poster.founder, path), 403, "PROPOSAL_OWN_USE_CASE");
		assertProblem(put(poster.founder, path, draft(null, null, null, List.of(), null)), 403, "PROPOSAL_OWN_USE_CASE");

		// The team names members of the organization only, each once, with one primary contact at most.
		UUID outsider = UUID.fromString(JsonPath.read(body(get(poster.founder, "/api/identity/me").expectStatus().isOk()),
				"$.id"));
		assertProblem(put(provider.founder, path,
				draft(null, null, null, List.of(member(outsider, "Spy", true)), null)), 400, "PROPOSAL_TEAM_INVALID");
		assertProblem(put(provider.founder, path, draft(null, null, null,
				List.of(member(provider.founderId, "A", false), member(provider.founderId, "B", false)), null)), 400,
				"PROPOSAL_TEAM_INVALID");
		assertProblem(put(provider.founder, path, draft(null, null, null,
				List.of(member(provider.founderId, "A", true), member(provider.colleagueId, "B", true)), null)), 400,
				"PROPOSAL_TEAM_INVALID");
		assertProblem(put(provider.founder, path, draft(UUID.randomUUID(), null, null, List.of(), null)), 400,
				"PROPOSAL_SOLUTION_NOT_FOUND");

		// Sending lists what is missing, one thing at a time.
		String saved = body(put(provider.founder, path, draft(null, null, null, List.of(), null)).expectStatus().isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		String send = API + "/use-case-proposals/" + id + "/send";
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_SOLUTION_REQUIRED");
		String withSolution = body(put(provider.founder, path,
				draft(provider.solution, null, null, List.of(), proposalVersion(saved))).expectStatus().isOk());
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_APPROACH_REQUIRED");
		String withApproach = body(put(provider.founder, path,
				draft(provider.solution, "Approach.", null, List.of(), proposalVersion(withSolution))).expectStatus().isOk());
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_PDF_REQUIRED");
		String withPdf = body(put(provider.founder, path, draft(provider.solution, "Approach.",
				file(provider.founderEmail), List.of(member(provider.founderId, "", true)), proposalVersion(withApproach)))
			.expectStatus()
			.isOk());
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_TEAM_INCOMPLETE");
		String withRole = body(put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", false)), proposalVersion(withPdf))).expectStatus().isOk());
		assertProblem(post(provider.founder, send, null), 400, "PROPOSAL_TEAM_INCOMPLETE");
		put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), proposalVersion(withRole))).expectStatus().isOk();

		// A member of another organization cannot send it.
		assertProblem(post(waiting.founder, send, null), 404, "PROPOSAL_NOT_FOUND");
		post(provider.founder, send, null).expectStatus().isOk();
	}

	@Test
	void aUseCaseThatClosedTakesNoProposals() {
		Provider provider = provider("closed.test");
		Poster poster = poster("posts-closed.test");
		UUID useCase = publishedUseCase(poster.organization, "Closing");
		String path = path(useCase);
		String saved = body(put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		put(provider.founder, "/api/talent/mine", profile("Closing Founder")).expectStatus().isOk();

		jdbc.sql("update use_case set closes_at = now() - interval '1 minute' where id = ?").params(useCase).update();

		assertProblem(get(provider.founder, path), 409, "PROPOSAL_USE_CASE_CLOSED");
		assertProblem(put(provider.founder, path, draft(null, null, null, List.of(), proposalVersion(saved))), 409,
				"PROPOSAL_USE_CASE_CLOSED");
		assertProblem(post(provider.founder, API + "/use-case-proposals/" + id + "/send", null), 409,
				"PROPOSAL_USE_CASE_CLOSED");
		assertProblem(get(provider.founder, API + "/use-cases/" + UUID.randomUUID() + "/proposal"), 404,
				"PROPOSAL_USE_CASE_NOT_FOUND");
		// What a closed use case received stays readable by those who posted it.
		get(poster.founder, path + "s").expectStatus().isOk();
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
				draft(provider.solution, "A sharper approach.", file(provider.colleagueEmail),
						List.of(member(provider.founderId, "Lead", true), member(provider.colleagueId, "Engineer", false)),
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
		assertProblem(put(provider.founder, path, draft(provider.solution, "Stale.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), proposalVersion(sent))), 409,
				"PROPOSAL_CHANGED_MEANWHILE");

		String read = body(get(poster.colleague, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.approach")).isEqualTo("A sharper approach.");
		assertThat(JsonPath.<String>read(read, "$.editedAt")).isNotNull();
		assertThat(JsonPath.<List<String>>read(read, "$.team[*].role")).containsExactly("Lead", "Engineer");
		String list = body(get(poster.founder, path + "s").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].editedAt")).hasSize(1).doesNotContainNull();

		// An edit must stay as complete as sending demanded; the codes are the same.
		long version = proposalVersion(edited);
		assertProblem(put(provider.founder, path, draft(null, "Approach.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), version)), 400, "PROPOSAL_SOLUTION_REQUIRED");
		assertProblem(put(provider.founder, path, draft(provider.solution, " ", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), version)), 400, "PROPOSAL_APPROACH_REQUIRED");
		assertProblem(put(provider.founder, path, draft(provider.solution, "Approach.", null,
				List.of(member(provider.founderId, "Lead", true)), version)), 400, "PROPOSAL_PDF_REQUIRED");
		assertProblem(put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", false)), version)), 400, "PROPOSAL_TEAM_INCOMPLETE");
		assertProblem(put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail),
				List.of(member(provider.founderId, " ", true)), version)), 400, "PROPOSAL_TEAM_INCOMPLETE");
		assertProblem(put(provider.founder, path, draft(provider.solution, "Approach.", file(provider.founderEmail),
				List.of(member(UUID.randomUUID(), "Lead", true)), version)), 400, "PROPOSAL_TEAM_INVALID");
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

		assertProblem(put(provider.founder, path, draft(provider.solution, "Too late.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), proposalVersion(sent))), 409,
				"PROPOSAL_EDIT_WINDOW_CLOSED");
		// It stays readable, as sent.
		String read = body(get(provider.founder, path).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.proposal.status")).isEqualTo("sent");
		assertThat(JsonPath.<Object>read(read, "$.proposal.editableUntil")).isNull();
		String received = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(received, "$.editedAt")).isNull();
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

		assertProblem(put(provider.founder, path, draft(provider.solution, "Nope.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), proposalVersion(sent))), 409,
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
		assertProblem(put(provider.founder, path, draft(provider.solution, "After close.", file(provider.founderEmail),
				List.of(member(provider.founderId, "Lead", true)), proposalVersion(sent))), 409,
				"PROPOSAL_EDIT_WINDOW_CLOSED");
		// An organization that sent nothing still finds the use case closed.
		Provider other = provider("closedview-other.test");
		assertProblem(get(other.founder, path), 409, "PROPOSAL_USE_CASE_CLOSED");
	}

	@Test
	void anOrganizationWaitingForReviewSendsWithoutATeamOrAProfileAndTheOrganizationIsMade() {
		Poster poster = poster("posts-waiting.test");
		UUID useCase = publishedUseCase(poster.organization, "Claims triage");
		String path = path(useCase);

		// Someone in no organization makes one in this step; it waits for review, and it sends all the same.
		String organization = path.substring(0, path.length() - "/proposal".length()) + "/organization";
		String loner = TestSignIn.session(client, mail, "alone@waiting-send.test");
		String made = body(post(loner, organization,
				Map.of("kind", "individual", "name", "Alone Builder", "country", "VN")).expectStatus().isOk());
		assertThat(JsonPath.<String>read(made, "$.organization.name")).isEqualTo("Alone Builder");
		assertThat(JsonPath.<Boolean>read(made, "$.organization.approved")).isFalse();
		assertProblem(post(loner, organization,
				Map.of("kind", "individual", "name", "Again", "country", "VN")), 409,
				"PROPOSAL_ALREADY_IN_ORGANIZATION");
		UUID solution = completeSolution(loner, "alone@waiting-send.test", "Lone Solver");
		String saved = body(put(loner, path, draft(solution, "Our approach.", file("alone@waiting-send.test"), List.of(),
				null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		String sent = body(post(loner, API + "/use-case-proposals/" + id + "/send", null).expectStatus().isOk());

		// It has no profile and no team; it carries who sent it, and the poster sees it as pending.
		assertThat(JsonPath.<Boolean>read(sent, "$.proposal.attachProfile")).isFalse();
		assertThat(JsonPath.<Object>read(sent, "$.proposal.sender")).isNull();
		assertThat(JsonPath.<String>read(sent, "$.proposal.sentBy.email")).isEqualTo("alone@waiting-send.test");
		String list = body(get(poster.founder, path + "s").expectStatus().isOk());
		assertThat(JsonPath.<List<Boolean>>read(list, "$.items[*].organizationApproved")).containsExactly(false);
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].contactName")).containsExactly("alone@waiting-send.test");
		String one = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(one, "$.organizationApproved")).isFalse();
		assertThat(JsonPath.<String>read(one, "$.sentBy.email")).isEqualTo("alone@waiting-send.test");
	}

	/** Saves a complete proposal as the founder, completes the founder's profile and sends it; returns its id. */
	private String sentProposal(Provider provider, UUID useCase) {
		String saved = body(put(provider.founder, path(useCase), draft(provider.solution, "We adapt it.",
				file(provider.founderEmail), List.of(member(provider.founderId, "Lead", true)), null))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(saved, "$.proposal.id");
		put(provider.founder, "/api/talent/mine", profile("Founder Provider")).expectStatus().isOk();
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
		put(duplicate.founder, "/api/talent/mine", profile("Duplicate Founder")).expectStatus().isOk();
		for (UUID useCase : List.of(first, second)) {
			String saved = body(put(duplicate.founder, path(useCase), draft(duplicate.solution, "Approach.",
					file(duplicate.founderEmail), List.of(member(duplicate.founderId, "Lead", true)), null))
				.expectStatus()
				.isOk());
			if (useCase.equals(second)) {
				post(duplicate.founder, API + "/use-case-proposals/" + JsonPath.read(saved, "$.proposal.id") + "/send",
						null).expectStatus().isOk();
			}
		}
		put(kept.founder, path(first), draft(null, null, null, List.of(), null)).expectStatus().isOk();

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

		Map<String, Object> two = draft(provider.solution, "Both.", null, List.of(), null);
		two.put("solutionIds", List.of(bare, provider.solution));
		String saved = body(put(provider.founder, path, two).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(saved, "$.proposal.solutions[*].name"))
			.containsExactly("Bare Desk", "Claim Copilot");
		assertThat(JsonPath.<List<String>>read(saved, "$.proposal.solutions[*].slug")).containsOnlyNulls();

		Map<String, Object> twice = draft(null, null, null, List.of(), proposalVersion(saved));
		twice.put("solutionIds", List.of(bare, bare));
		assertProblem(put(provider.founder, path, twice), 400, "PROPOSAL_SOLUTION_NOT_FOUND");
		twice.put("solutionIds", List.of(unknown));
		assertProblem(put(provider.founder, path, twice), 400, "PROPOSAL_SOLUTION_NOT_FOUND");
	}

	/** An organization, approved or not, with a founder, a colleague and a complete solution. */
	private Provider provider(String domain) {
		return provider(domain, true);
	}

	private Provider provider(String domain, boolean approved) {
		String founder = TestSignIn.session(client, mail, "founder@" + domain);
		UUID organization = UUID.fromString(JsonPath.read(body(post(founder, ORGANIZATION + "/organizations",
				Map.of("name", "Team " + domain, "type", "company", "country", "VN", "teamSize", "2_9", "industries",
						List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
		String colleague = TestSignIn.session(client, mail, "colleague@" + domain);
		UUID solution = null;
		if (approved) {
			post(operator, ORGANIZATION + "/admin/organizations/" + organization + "/approve", Map.of()).expectStatus()
				.isNoContent();
			post(founder, ORGANIZATION + "/mine/invitations", Map.of("email", "colleague@" + domain, "role", "member"))
				.expectStatus()
				.isNoContent();
			String invitation = JsonPath.read(body(get(colleague, ORGANIZATION + "/mine").expectStatus().isOk()),
					"$.invitations[0].id");
			post(colleague, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
			solution = completeSolution(founder, "founder@" + domain, "Claim Copilot");
		}
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

	private static Map<String, Object> member(UUID account, String role, boolean primary) {
		Map<String, Object> member = new LinkedHashMap<>();
		member.put("accountId", account);
		member.put("role", role);
		member.put("primary", primary);
		return member;
	}

	/** The request, with the sender's talent profile going with the proposal. */
	private static Map<String, Object> attached(Map<String, Object> request) {
		request.put("attachProfile", true);
		return request;
	}

	private static Map<String, Object> draft(UUID solution, String approach, UUID deck, List<Map<String, Object>> team,
			Long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("attachProfile", false);
		request.put("solutionIds", solution == null ? List.of() : List.of(solution));
		request.put("approach", approach);
		request.put("deckFileId", deck);
		request.put("team", new ArrayList<>(team));
		request.put("version", version);
		return request;
	}

	private static Map<String, Object> profile(String name) {
		return profile(name, null);
	}

	private static Map<String, Object> profile(String name, Long version) {
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

	private long profileVersion(String session) {
		return JsonPath.<Number>read(body(get(session, "/api/talent/mine").expectStatus().isOk()), "$.profile.version")
			.longValue();
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
