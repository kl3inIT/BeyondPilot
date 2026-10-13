package ai.genaifund.beyondpilot.proposal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].solutionNames[*]")).containsExactly("Claim Copilot");
			assertThat(JsonPath.<List<String>>read(list, "$.items[*].contactName"))
				.hasSize(1);
		}
		String one = body(get(poster.colleague, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.approach")).isEqualTo("We adapt it to your onboarding flow.");
		assertThat(JsonPath.<String>read(one, "$.sentBy.email")).isEqualTo(provider.founderEmail);
		assertThat(JsonPath.<String>read(one, "$.sentBy.phone")).isEqualTo("+84 912 345 678");
		assertThat(JsonPath.<String>read(one, "$.deck.fileName")).isEqualTo("proposal.pdf");
		// An operator reads what any use case received; the PDF is found for them (the test has no bytes behind it).
		assertThat(JsonPath.<List<String>>read(body(get(operator, path + "s").expectStatus().isOk()),
				"$.items[*].organizationName")).containsExactly("Team sends.test");
		assertThat(JsonPath.<String>read(body(get(operator, API + "/use-case-proposals/" + id).expectStatus().isOk()),
				"$.sentBy.email")).isEqualTo(provider.founderEmail);
		get(operator, API + "/use-case-proposals/" + id + "/file").expectStatus().value(status -> assertThat(status).isNotEqualTo(404));
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

		// An organization that waits for GenAI Fund's review works on a proposal like any other.
		Provider waiting = provider("waiting.test", false);
		assertThat(JsonPath.<Boolean>read(body(get(waiting.founder, path).expectStatus().isOk()),
				"$.organization.approved")).isFalse();
		put(waiting.founder, path, draft(null, null, null, null, null)).expectStatus().isOk();

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
		assertProblem(post(waiting.founder, send, null), 404, "PROPOSAL_NOT_FOUND");
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

		// Someone in no organization makes one in this step; it waits for review, and it sends all the same.
		String loner = TestSignIn.session(client, mail, "alone@waiting-send.test");
		String made = body(post(loner, ORGANIZATION + "/organizations/basics", Map.of("name", "Alone Builder", "type",
				"independent_builder", "teamSize", "just_me", "industries", List.of(), "country", "VN"))
			.expectStatus()
			.isCreated());
		assertThat(JsonPath.<String>read(made, "$.name")).isEqualTo("Alone Builder");
		String form = body(get(loner, path).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(form, "$.organization.approved")).isFalse();
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
		assertThat(JsonPath.<List<Boolean>>read(list, "$.items[*].organizationApproved")).containsExactly(false);
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].contactName")).containsExactly("Founder Provider");
		String one = body(get(poster.founder, API + "/use-case-proposals/" + id).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(one, "$.organizationApproved")).isFalse();
		assertThat(JsonPath.<String>read(one, "$.sentBy.email")).isEqualTo("alone@waiting-send.test");
		assertThat(JsonPath.<Object>read(one, "$.teamBackground")).isNull();
	}

	@Test
	void aTeamSaysWhatItHasDoneBeforeItSends() {
		Poster poster = poster("posts-team.test");
		UUID useCase = publishedUseCase(poster.organization, "Document reading");
		String path = path(useCase);

		String lead = TestSignIn.session(client, mail, "lead@team-send.test");
        post(lead, ORGANIZATION + "/organizations/basics", Map.of("name", "Doc Team", "type", "builder_team", "teamSize",
                "2_9", "industries", List.of(), "country", "VN", "teamBackground", "Built document assistants."))
			.expectStatus()
			.isCreated();
        assertThat(JsonPath.<String>read(body(get(lead, path).expectStatus().isOk()), "$.organization.type"))
            .isEqualTo("builder_team");
        assertThat(JsonPath.<String>read(body(get(lead, path).expectStatus().isOk()), "$.organization.teamBackground"))
            .isEqualTo("Built document assistants.");
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
