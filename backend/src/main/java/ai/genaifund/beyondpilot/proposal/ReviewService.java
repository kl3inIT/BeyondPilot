package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.organization.OrganizationProfile;
import ai.genaifund.beyondpilot.program.ApplicationForm;
import ai.genaifund.beyondpilot.proposal.ReviewAccess.Reviewing;
import ai.genaifund.beyondpilot.proposal.dto.AttachedFileResponse;
import ai.genaifund.beyondpilot.proposal.dto.ContactDetails;
import ai.genaifund.beyondpilot.proposal.dto.CriterionResponse;
import ai.genaifund.beyondpilot.proposal.dto.ExportApplicationsRequest;
import ai.genaifund.beyondpilot.proposal.dto.ProgramDraftsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewDraftResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewHeadResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveAssessmentRequest;
import ai.genaifund.beyondpilot.proposal.persistence.Proposal;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalAssessment;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalAssessmentRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRelease;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReleaseRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewDecision;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewDecisionRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalVersion;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalVersionRepository;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.solution.OfferedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Scoring a program's applications. Operators and the judges a program invited read each submitted application as it
 * was sent last, and score it on the program's criteria; a judge reads only their own scores, an operator every one.
 */
@Service
public class ReviewService {

	private static final Logger LOG = LoggerFactory.getLogger(ReviewService.class);

	private static final int LOWEST = 1;

	private static final int HIGHEST = 5;

	private static final TypeReference<Map<UUID, Integer>> SCORES = new TypeReference<>() {
	};

	private static final TypeReference<Map<String, String>> ANSWERS = new TypeReference<>() {
	};

	private final ReviewSetup setup;

	private final ReviewAccess access;

	private final ProposalRepository proposals;

	private final ProposalVersionRepository versions;

	private final ProposalAssessmentRepository assessments;

	private final ProposalReviewDecisionRepository decisions;

	private final ProposalReleaseRepository releases;

	private final IdentityService identity;

	private final StorageService storage;

	private final JsonMapper json;

	private final OrganizationDirectory organizations;

	private final SolutionDirectory solutions;

	ReviewService(ReviewSetup setup, ReviewAccess access, ProposalRepository proposals,
			ProposalVersionRepository versions, ProposalAssessmentRepository assessments,
			ProposalReviewDecisionRepository decisions, ProposalReleaseRepository releases, IdentityService identity,
			StorageService storage, JsonMapper json, OrganizationDirectory organizations, SolutionDirectory solutions) {
		this.organizations = organizations;
		this.solutions = solutions;
		this.setup = setup;
		this.access = access;
		this.proposals = proposals;
		this.versions = versions;
		this.assessments = assessments;
		this.decisions = decisions;
		this.releases = releases;
		this.identity = identity;
		this.storage = storage;
		this.json = json;
	}

	/**
	 * A program's submitted applications as the caller reviews them, with drafts and withdrawals counted.
	 * @throws ProposalException when the program takes no applications, or the caller does not review it
	 */
	@Transactional
	public ReviewApplicationsResponse applications(Actor actor, UUID programId) {
		ApplicationForm form = setup.form(programId);
		Reviewing reviewing = access.of(actor, programId);
		ReviewHeadResponse head = head(form, reviewing);
		List<Proposal> submitted = proposals.findByProgramIdAndStatusOrderBySubmittedAt(programId, Proposal.SUBMITTED);
		Map<UUID, List<ProposalAssessment>> byProposal = new HashMap<>();
		for (ProposalAssessment assessment : assessments
			.findByProposalIdIn(submitted.stream().map(Proposal::getId).toList())) {
			byProposal.computeIfAbsent(assessment.getProposalId(), id -> new ArrayList<>()).add(assessment);
		}
		Map<VersionKey, Snapshot> snapshots = snapshots(submitted);
		ReviewHeadResponse.ChoiceQuestion choice = head.choice();
		List<ReviewApplicationsResponse.Item> items = new ArrayList<>();
		for (Proposal proposal : submitted) {
			Snapshot snapshot = snapshots.get(new VersionKey(proposal.getId(), proposal.getSubmissions()));
			if (snapshot == null) {
				continue;
			}
			List<ProposalAssessment> all = byProposal.getOrDefault(proposal.getId(), List.of());
			ProposalAssessment mine = all.stream()
				.filter(assessment -> assessment.getAccountId().equals(reviewing.accountId()))
				.findFirst()
				.orElse(null);
			items.add(new ReviewApplicationsResponse.Item(proposal.getId(), snapshot.solution().name(),
					snapshot.organization().name(), snapshot.organization().type(), snapshot.organization().country(),
					choice == null ? null : choiceOf(snapshot, choice.id()), Objects.requireNonNull(proposal.getSubmittedAt()),
					proposal.getSubmissions(), reviewing.operator() ? proposal.getReviewStatus() : null,
					reviewing.operator() ? average(all) : mine == null ? null : mean(mine),
					reviewing.operator() ? (int) all.stream().filter(assessment -> !assessment.isConflict()).count() : null,
					mine == null ? "none" : mine.isConflict() ? "conflict" : "scored", reviewing.owns(proposal)));
		}
		return new ReviewApplicationsResponse(head, items,
				proposals.countByProgramIdAndStatus(programId, Proposal.DRAFT),
				proposals.countByProgramIdAndStatus(programId, Proposal.WITHDRAWN));
	}

	/**
	 * A program's submitted applications as a spreadsheet, the earliest submitted first, for GenAI Fund to work with
	 * outside BeyondPilot. The download is recorded, since it takes applicants' contact details out.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the program takes no applications
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, UUID programId, ExportApplicationsRequest request,
			SpreadsheetFormat format) {
		Operator operator = access.operator(actor);
		ApplicationForm form = setup.form(programId);
		ReviewHeadResponse head = head(form, access.of(actor, programId));
		List<UUID> asked = request.applicationIds();
		Set<UUID> only = asked == null ? null : Set.copyOf(asked);
		List<Proposal> submitted = proposals.findByProgramIdAndStatusOrderBySubmittedAt(programId, Proposal.SUBMITTED)
			.stream()
			.filter(proposal -> only == null || only.contains(proposal.getId()))
			.toList();
		Map<UUID, List<ProposalAssessment>> byProposal = new HashMap<>();
		for (ProposalAssessment assessment : assessments
			.findByProposalIdIn(submitted.stream().map(Proposal::getId).toList())) {
			byProposal.computeIfAbsent(assessment.getProposalId(), id -> new ArrayList<>()).add(assessment);
		}
		Map<VersionKey, Snapshot> snapshots = snapshots(submitted);
		ReviewHeadResponse.ChoiceQuestion choice = head.choice();
		List<ApplicationLine> lines = new ArrayList<>();
		for (Proposal proposal : submitted) {
			Snapshot snapshot = snapshots.get(new VersionKey(proposal.getId(), proposal.getSubmissions()));
			if (snapshot == null) {
				continue;
			}
			List<ProposalAssessment> all = byProposal.getOrDefault(proposal.getId(), List.of());
			lines.add(new ApplicationLine(proposal.getId(), snapshot.organization().name(),
					snapshot.organization().type(), snapshot.solution().name(), snapshot.applicant().contact(),
					snapshot.applicant().email(), choice == null ? null : choiceOf(snapshot, choice.id()),
					Objects.requireNonNull(proposal.getSubmittedAt()), proposal.getSubmissions(),
					proposal.getReviewStatus(), head.releasedAt() != null,
					all.stream().filter(assessment -> !assessment.isConflict()).count(), average(all)));
		}
		Spreadsheet<ApplicationLine> sheet = Spreadsheet.<ApplicationLine>of("Applications")
			.text("Application", ApplicationLine::id)
			.group("Applicant")
			.text("Organization", ApplicationLine::organization)
			.label("Organization type", ApplicationLine::organizationType)
			.text("Solution", ApplicationLine::solution)
			.group("Contact")
			.text("First name", line -> line.contact().firstName())
			.text("Last name", line -> line.contact().lastName())
			.email("Email", ApplicationLine::email)
			.text("Phone", line -> line.contact().phone())
			.text("Country", line -> line.contact().country())
			.link("LinkedIn", line -> line.contact().linkedin())
			.ungrouped()
			.text(choice == null ? "Choice" : choice.label(), ApplicationLine::choice)
			.group("Review")
			.time("Submitted at", ApplicationLine::submittedAt)
			.count("Version", ApplicationLine::version)
			.label("Review status", ApplicationLine::reviewStatus)
			.yesNo("Outcome released", ApplicationLine::released)
			.count("Scores", ApplicationLine::scores)
			.decimal("Average score", ApplicationLine::average);
		SpreadsheetFile file = sheet.write(format, form.slug() + "-applications", lines,
				about(operator, only == null ? Map.of() : Map.of("Applications", "the ones the list showed")));
		setup.record(AuditAction.PROPOSAL_EXPORT, operator, form, Map.of("count", String.valueOf(file.rows())));
		LOG.atInfo()
			.addKeyValue("event", "proposal.applications.exported")
			.addKeyValue("program_id", programId)
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Applications exported");
		return file;
	}

	/**
	 * A program's drafts not submitted yet, the most recently saved first, for operators to follow up before the
	 * close: who started each, how to reach them and how far they got. What a draft says stays the applicant's, so
	 * neither its answers, its deck nor its solution are read out; judges never see drafts.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the program takes no applications
	 */
	@Transactional(readOnly = true)
	public ProgramDraftsResponse drafts(Actor actor, UUID programId) {
		access.operator(actor);
		ApplicationForm form = setup.form(programId);
		List<Proposal> drafts = proposals.findByProgramIdAndStatusOrderByUpdatedAtDesc(programId, Proposal.DRAFT);
		Map<UUID, Person> people = identity.people(drafts.stream().map(Proposal::getAccountId).toList());
		Map<UUID, OrganizationName> names = organizations
			.names(drafts.stream().map(Proposal::getOrganizationId).filter(Objects::nonNull).toList());
		Map<UUID, String> types = new HashMap<>();
		for (UUID id : names.keySet()) {
			organizations.profile(id).ifPresent(profile -> types.put(id, profile.type()));
		}
		List<ApplicationForm.Question> required = form.questions().stream().filter(ApplicationForm.Question::required).toList();
		List<ProgramDraftsResponse.Item> items = new ArrayList<>();
		for (Proposal draft : drafts) {
			ContactDetails contact = json.readValue(draft.getContact(), ContactDetails.class);
			Map<String, String> answers = json.readValue(draft.getAnswers(), ANSWERS);
			Person person = people.get(draft.getAccountId());
			UUID organizationId = draft.getOrganizationId();
			OrganizationName organization = organizationId == null ? null : names.get(organizationId);
			int answered = (int) required.stream()
				.filter(question -> !blank(answers.get(question.id().toString())))
				.count();
			items.add(new ProgramDraftsResponse.Item(draft.getId(), text(contact.firstName()), text(contact.lastName()),
					person == null ? "" : person.email(), text(contact.phone()), text(contact.country()),
					organization == null ? null : organization.name(),
					organizationId == null ? null : types.get(organizationId),
					!blank(contact.firstName()) && !blank(contact.lastName()) && !blank(contact.phone())
							&& !blank(contact.country()),
					draft.getSolutionId() != null, draft.getDeckFileId() != null, answered, draft.getCreatedAt(),
					draft.getUpdatedAt()));
		}
		return new ProgramDraftsResponse(items, required.size());
	}

	/**
	 * A program's drafts not submitted yet as a spreadsheet, the most recently saved first, to write to their
	 * applicants outside BeyondPilot. The download is recorded, since it takes their contact details out.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the program takes no applications
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile exportDrafts(Actor actor, UUID programId, SpreadsheetFormat format) {
		Operator operator = access.operator(actor);
		ApplicationForm form = setup.form(programId);
		ProgramDraftsResponse drafts = drafts(actor, programId);
		Spreadsheet<ProgramDraftsResponse.Item> sheet = Spreadsheet.<ProgramDraftsResponse.Item>of("Drafts")
			.text("Draft", ProgramDraftsResponse.Item::id)
			.group("Contact")
			.text("First name", ProgramDraftsResponse.Item::firstName)
			.text("Last name", ProgramDraftsResponse.Item::lastName)
			.email("Email", ProgramDraftsResponse.Item::email)
			.text("Phone", ProgramDraftsResponse.Item::phone)
			.text("Country", ProgramDraftsResponse.Item::country)
			.group("Organization")
			.text("Organization", ProgramDraftsResponse.Item::organizationName)
			.label("Organization type", ProgramDraftsResponse.Item::organizationType)
			.group("Progress")
			.yesNo("Contact complete", ProgramDraftsResponse.Item::contactComplete)
			.yesNo("Solution chosen", ProgramDraftsResponse.Item::solutionChosen)
			.yesNo("Deck attached", ProgramDraftsResponse.Item::deckAttached)
			.text("Required questions answered", item -> item.requiredAnswered() + " of " + drafts.requiredQuestions())
			.time("Started at", ProgramDraftsResponse.Item::startedAt)
			.time("Last saved at", ProgramDraftsResponse.Item::lastSavedAt);
		SpreadsheetFile file = sheet.write(format, form.slug() + "-drafts", drafts.items(), about(operator, Map.of()));
		setup.record(AuditAction.PROPOSAL_DRAFTS_EXPORT, operator, form, Map.of("count", String.valueOf(file.rows())));
		LOG.atInfo()
			.addKeyValue("event", "proposal.drafts.exported")
			.addKeyValue("program_id", programId)
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Drafts exported");
		return file;
	}

	private static Spreadsheet.About about(Operator operator, Map<String, String> narrowed) {
		return new Spreadsheet.About(operator.label(), Instant.now(), narrowed);
	}

	/** One submitted application as the download lists it. */
	private record ApplicationLine(UUID id, String organization, String organizationType, String solution,
			ContactDetails contact, String email, @Nullable String choice, Instant submittedAt, int version,
			String reviewStatus, boolean released, long scores, @Nullable Double average) {
	}

	/**
	 * An application not submitted yet as it stands now, for an operator to see who may yet apply; judges never read
	 * a draft.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when there is no such draft
	 */
	@Transactional
	public ReviewDraftResponse draft(Actor actor, UUID id) {
		access.operator(actor);
		Proposal draft = draftOf(id);
		ApplicationForm form = setup.form(draft.getProgramId());
		ContactDetails contact = json.readValue(draft.getContact(), ContactDetails.class);
		Map<String, String> answers = json.readValue(draft.getAnswers(), ANSWERS);
		Person person = identity.people(List.of(draft.getAccountId())).get(draft.getAccountId());
		UUID organizationId = draft.getOrganizationId();
		OrganizationProfile organization = organizationId == null ? null
				: organizations.profile(organizationId).orElse(null);
		UUID solutionId = draft.getSolutionId();
		OfferedSolution solution = solutionId == null ? null : solutions.offered(solutionId).orElse(null);
		UUID deckId = draft.getDeckFileId();
		List<ReviewApplicationResponse.Answer> answered = new ArrayList<>();
		for (ApplicationForm.Question question : form.questions()) {
			String value = answers.get(question.id().toString());
			if (blank(value)) {
				continue;
			}
			AttachedFileResponse file = "file".equals(question.kind()) ? attached(UUID.fromString(value)) : null;
			answered.add(new ReviewApplicationResponse.Answer(question.id(), question.label(), question.kind(), value,
					file));
		}
		ReviewApplicationResponse.Submitted shown = new ReviewApplicationResponse.Submitted(
				person == null ? "" : person.email(), contact, organization == null ? "" : organization.name(),
				organization == null ? "" : organization.type(), organization == null ? null : organization.country(),
				organization == null ? null : organization.teamSize(),
				organization == null ? null : organization.website(), draft.getTeamBackground(),
				solution == null ? "" : solution.name(), solution == null ? null : solution.summary(),
				solution == null ? null : solution.problemsSolved(), solution == null ? null : solution.maturity(),
				solution == null ? null : solution.demoUrl(), deckId == null ? null : attached(deckId),
				draft.getBuiltWith(), draft.getTraction(), answered);
		return new ReviewDraftResponse(head(form, access.of(actor, form.programId())), id, draft.getCreatedAt(),
				draft.getUpdatedAt(), shown);
	}

	/**
	 * A file of a draft, for an operator reading it: its deck or a file it answers a question with.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when there is no such draft, or the file is not one of it
	 */
	@Transactional
	public FileDownload draftFile(Actor actor, UUID id, UUID fileId) {
		access.operator(actor);
		Proposal draft = draftOf(id);
		Map<String, String> answers = json.readValue(draft.getAnswers(), ANSWERS);
		boolean held = fileId.equals(draft.getDeckFileId()) || answers.containsValue(fileId.toString());
		if (!held) {
			throw new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND,
					"File " + fileId + " is not of draft " + id);
		}
		return storage.download(fileId);
	}

	private Proposal draftOf(UUID id) {
		return proposals.findById(id)
			.filter(proposal -> Proposal.DRAFT.equals(proposal.getStatus()))
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND, "No draft " + id));
	}

	private @Nullable AttachedFileResponse attached(UUID fileId) {
		return storage.describe(fileId)
			.map(file -> new AttachedFileResponse(file.id(), file.fileName(), file.sizeBytes()))
			.orElse(null);
	}

	private static @Nullable String text(@Nullable String value) {
		return blank(value) ? null : Objects.requireNonNull(value).strip();
	}

	private static boolean blank(@Nullable String value) {
		return value == null || value.isBlank();
	}

	/**
	 * A program's submitted applications as an operator reviews them, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the program takes no applications
	 */
	@Transactional
	public ProgramApplications applicationsOf(Actor actor, UUID programId) {
		identity.requireOperator(actor);
		ReviewApplicationsResponse response = applications(actor, programId);
		return new ProgramApplications(response.drafts(), response.withdrawn(), response.items()
			.stream()
			.map(item -> new ProgramApplications.Application(item.id(), item.solutionName(), item.organizationName(),
					item.organizationType(), item.country(), item.submittedAt(), item.version(), item.reviewStatus(),
					item.average(), item.scored() == null ? 0 : item.scored()))
			.toList());
	}

	/**
	 * One submitted application as its applicant sent it last, with the caller's assessment; an operator also reads
	 * every other assessment and the decisions.
	 * @throws ProposalException when there is no such submitted application, or the caller does not review its program
	 */
	@Transactional
	public ReviewApplicationResponse application(Actor actor, UUID id) {
		Proposal proposal = submitted(id);
		ApplicationForm form = setup.form(proposal.getProgramId());
		Reviewing reviewing = access.of(actor, proposal.getProgramId());
		return view(form, reviewing, proposal);
	}

	/**
	 * One submitted application as its applicant sent it last, with every assessment, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when there is no such submitted application
	 */
	@Transactional
	public SubmittedApplication applicationOf(Actor actor, UUID id) {
		identity.requireOperator(actor);
		ReviewApplicationResponse view = application(actor, id);
		ReviewHeadResponse head = view.head();
		ReviewApplicationResponse.Submitted sent = view.submitted();
		ContactDetails contact = sent.contact();
		List<SubmittedApplication.Assessment> assessments = new ArrayList<>();
		if (view.mine() != null) {
			assessments.add(assessment(Objects.requireNonNull(view.mine())));
		}
		view.others().forEach(other -> assessments.add(assessment(other)));
		return new SubmittedApplication(view.id(),
				new SubmittedApplication.Program(head.programId(), head.slug(), head.name()), view.version(),
				view.submittedAt(), view.reviewStatus(), view.average(),
				new SubmittedApplication.Applicant(sent.email(), contact.firstName(), contact.lastName(),
						contact.phone(), contact.country(), contact.linkedin()),
				new SubmittedApplication.Organization(sent.organizationName(), sent.organizationType(), sent.country(),
						sent.teamSize(), sent.website(), sent.teamBackground()),
				new SubmittedApplication.Solution(sent.solutionName(), sent.summary(), sent.problemsSolved(),
						sent.maturity(), sent.demoUrl(), sent.builtWith(), sent.traction(), file(sent.deck())),
				sent.answers()
					.stream()
					.map(answer -> new SubmittedApplication.Answer(answer.label(), answer.kind(), answer.value(),
							file(answer.file())))
					.toList(),
				head.criteria()
					.stream()
					.map(criterion -> new SubmittedApplication.Criterion(criterion.id(), criterion.name(),
							criterion.description()))
					.toList(),
				List.copyOf(assessments));
	}

	/**
	 * Keeps the caller's assessment of an application on the version it was submitted as last. It changes until the
	 * outcomes are released.
	 * @throws ProposalException when there is no such submitted application, the caller does not review its program,
	 * the program has no criteria, its outcomes were released, or a criterion is not scored from 1 to 5
	 */
	@Transactional
	public ReviewApplicationResponse assess(Actor actor, UUID id, SaveAssessmentRequest request) {
		Proposal proposal = submitted(id);
		ApplicationForm form = setup.form(proposal.getProgramId());
		Reviewing reviewing = access.of(actor, proposal.getProgramId());
		requireNotOwn(reviewing, proposal);
		requireNotReleased(form);
		List<CriterionResponse> criteria = setup.criteriaOf(form.programId()).criteria();
		if (criteria.isEmpty()) {
			throw new ProposalException(ProposalErrorCode.NO_CRITERIA,
					"Assessment of application " + id + " before its program has criteria");
		}
		Map<UUID, Integer> scores = new LinkedHashMap<>();
		if (!request.conflict()) {
			Set<UUID> expected = new HashSet<>();
			criteria.forEach(criterion -> expected.add(criterion.id()));
			if (!request.scores().keySet().equals(expected)) {
				throw invalid(id);
			}
			for (CriterionResponse criterion : criteria) {
				Integer score = request.scores().get(criterion.id());
				if (score == null || score < LOWEST || score > HIGHEST) {
					throw invalid(id);
				}
				scores.put(criterion.id(), score);
			}
		}
		ProposalAssessment assessment = assessments
			.findById(new ProposalAssessment.Key(id, reviewing.accountId()))
			.orElseGet(() -> new ProposalAssessment(id, reviewing.accountId()));
		String note = request.note();
		assessment.write(proposal.getSubmissions(), json.writeValueAsString(scores),
				note == null || note.isBlank() ? null : note.strip(), request.conflict(), Instant.now());
		assessments.saveAndFlush(assessment);
		LOG.atInfo()
			.addKeyValue("event", "proposal.assessment.saved")
			.addKeyValue("proposal_id", id)
			.addKeyValue("conflict", request.conflict())
			.log("Assessment saved");
		return view(form, reviewing, proposal);
	}

	/**
	 * A file of an application's last submission, its deck or a file it answered with. Opening it is recorded.
	 * @throws ProposalException when there is no such submitted application, the caller does not review its program, or
	 * the file is not one the submission holds
	 */
	@Transactional
	public FileDownload file(Actor actor, UUID id, UUID fileId) {
		Proposal proposal = submitted(id);
		access.of(actor, proposal.getProgramId());
		held(proposal, fileId);
		return storage.download(fileId);
	}

	/**
	 * A file of an application's last submission, opened for an operator's app to read, as {@link #file} opens it for
	 * the page.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when there is no such submitted application, or the file is not one it holds
	 */
	@Transactional
	public ApplicationFile fileOf(Actor actor, UUID id, UUID fileId) {
		identity.requireOperator(actor);
		Proposal proposal = submitted(id);
		access.of(actor, proposal.getProgramId());
		AttachedFileResponse file = held(proposal, fileId);
		return new ApplicationFile(fileId, file.fileName(), storage.content(fileId));
	}

	ReviewHeadResponse head(ApplicationForm form, Reviewing reviewing) {
		ReviewHeadResponse.ChoiceQuestion choice = form.questions()
			.stream()
			.filter(question -> "single_choice".equals(question.kind()))
			.findFirst()
			.map(question -> new ReviewHeadResponse.ChoiceQuestion(question.id(), question.label(), question.options()))
			.orElse(null);
		return new ReviewHeadResponse(form.programId(), form.slug(), form.name(), form.closesAt(),
				form.outcomesDueOn(), !Instant.now().isBefore(form.closesAt()),
				releases.findById(form.programId()).map(ProposalRelease::getReleasedAt).orElse(null),
				reviewing.operator(), setup.criteriaOf(form.programId()).criteria(), choice);
	}

	/**
	 * A submitted application.
	 * @throws ProposalException when there is none with this identifier
	 */
	Proposal submitted(UUID id) {
		return proposals.findById(id)
			.filter(Proposal::isSubmitted)
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND,
					"No submitted application " + id));
	}

	/**
	 * Refuses a reviewer the application of their own or of their organization.
	 * @throws ProposalException when the application is theirs
	 */
	void requireNotOwn(Reviewing reviewing, Proposal proposal) {
		if (reviewing.owns(proposal)) {
			throw new ProposalException(ProposalErrorCode.OWN_APPLICATION,
					"Account " + reviewing.accountId() + " reviewing its own application " + proposal.getId());
		}
	}

	void requireNotReleased(ApplicationForm form) {
		if (releases.existsById(form.programId())) {
			throw new ProposalException(ProposalErrorCode.RELEASED,
					"Review of program " + form.programId() + " after its release");
		}
	}

	/** The mean of every judge's own mean, leaving out conflicts; null when nobody scored. */
	@Nullable Double average(Collection<ProposalAssessment> all) {
		OptionalDouble mean = all.stream()
			.filter(assessment -> !assessment.isConflict())
			.map(this::mean)
			.filter(Objects::nonNull)
			.mapToDouble(Double::doubleValue)
			.average();
		return mean.isPresent() ? round(mean.getAsDouble()) : null;
	}

	/** What a submission held. */
	Snapshot snapshot(Proposal proposal) {
		ProposalVersion version = versions.findById(new ProposalVersion.Key(proposal.getId(), proposal.getSubmissions()))
			.orElseThrow(() -> new IllegalStateException("Application " + proposal.getId() + " has no last version"));
		return json.readValue(version.getSnapshot(), Snapshot.class);
	}

	/**
	 * The file of a submission with this identifier: its deck or a file it answered with.
	 * @throws ProposalException when the submission holds no such file
	 */
	private AttachedFileResponse held(Proposal proposal, UUID fileId) {
		Snapshot snapshot = snapshot(proposal);
		return Stream
			.concat(Stream.ofNullable(snapshot.materials().deck()),
					snapshot.answers().stream().map(Snapshot.Answer::file).filter(Objects::nonNull))
			.filter(file -> file.fileId().equals(fileId))
			.findFirst()
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND,
					"File " + fileId + " is not of application " + proposal.getId()));
	}

	private static SubmittedApplication.@Nullable File file(@Nullable AttachedFileResponse file) {
		return file == null ? null : new SubmittedApplication.File(file.fileId(), file.fileName(), file.sizeBytes());
	}

	private static SubmittedApplication.Assessment assessment(ReviewApplicationResponse.Assessment assessment) {
		return new SubmittedApplication.Assessment(assessment.reviewer(), assessment.role(), assessment.scores(),
				assessment.average(), assessment.note(), assessment.conflict(), assessment.version());
	}

	private ReviewApplicationResponse view(ApplicationForm form, Reviewing reviewing, Proposal proposal) {
		Snapshot snapshot = snapshot(proposal);
		List<ProposalAssessment> all = assessments.findByProposalIdOrderBySavedAt(proposal.getId());
		Set<UUID> authors = new HashSet<>();
		all.forEach(assessment -> authors.add(assessment.getAccountId()));
		List<ProposalReviewDecision> decided = reviewing.operator()
				? decisions.findByProposalIdOrderByDecidedAt(proposal.getId()) : List.of();
		decided.forEach(decision -> authors.add(decision.getAccountId()));
		Map<UUID, Person> people = identity.people(authors);
		Set<UUID> judges = new HashSet<>();
		setup.judgesOf(form.programId()).forEach(judges::add);

		ReviewApplicationResponse.Assessment mine = null;
		List<ReviewApplicationResponse.Assessment> others = new ArrayList<>();
		for (ProposalAssessment assessment : all) {
			ReviewApplicationResponse.Assessment shown = shown(assessment, people.get(assessment.getAccountId()),
					judges.contains(assessment.getAccountId()) ? "reviewer" : "operator");
			if (assessment.getAccountId().equals(reviewing.accountId())) {
				mine = shown;
			}
			else if (reviewing.operator()) {
				others.add(shown);
			}
		}

		List<ReviewApplicationResponse.Event> history = new ArrayList<>();
		for (ProposalVersion version : versions.findByProposalIdOrderByNumber(proposal.getId())) {
			history.add(new ReviewApplicationResponse.Event("submitted", version.getSubmittedAt(), version.getNumber(),
					null, null, null));
		}
		for (ProposalReviewDecision decision : decided) {
			Person by = people.get(decision.getAccountId());
			history.add(new ReviewApplicationResponse.Event("decided", decision.getDecidedAt(), null,
					decision.getToStatus(), decision.getReason(), by == null ? null : by.label()));
		}
		history.sort(Comparator.comparing(ReviewApplicationResponse.Event::at));

		List<UUID> order = setup.submitted(form.programId());
		int index = order.indexOf(proposal.getId());
		return new ReviewApplicationResponse(head(form, reviewing), proposal.getId(), proposal.getSubmissions(),
				Objects.requireNonNull(proposal.getSubmittedAt()), submitted(snapshot),
				reviewing.operator() ? proposal.getReviewStatus() : null, mine, others,
				reviewing.operator() ? average(all) : null, history, index + 1, order.size(),
				index > 0 ? order.get(index - 1) : null, index >= 0 && index + 1 < order.size() ? order.get(index + 1) : null,
				reviewing.owns(proposal));
	}

	private ReviewApplicationResponse.Assessment shown(ProposalAssessment assessment, @Nullable Person person,
			String role) {
		return new ReviewApplicationResponse.Assessment(person == null ? "" : person.label(), role,
				json.readValue(assessment.getScores(), SCORES), mean(assessment), assessment.getNote(),
				assessment.isConflict(), assessment.getVersionNumber(), assessment.getSavedAt());
	}

	private @Nullable Double mean(ProposalAssessment assessment) {
		if (assessment.isConflict()) {
			return null;
		}
		OptionalDouble mean = json.readValue(assessment.getScores(), SCORES)
			.values()
			.stream()
			.mapToInt(Integer::intValue)
			.average();
		return mean.isPresent() ? round(mean.getAsDouble()) : null;
	}

	private static double round(double value) {
		return Math.round(value * 10) / 10.0;
	}

	private Map<VersionKey, Snapshot> snapshots(List<Proposal> submitted) {
		Map<VersionKey, Snapshot> snapshots = new HashMap<>();
		List<ProposalVersion.Key> keys = submitted.stream()
			.map(proposal -> new ProposalVersion.Key(proposal.getId(), proposal.getSubmissions()))
			.toList();
		for (ProposalVersion version : versions.findAllById(keys)) {
			snapshots.put(new VersionKey(version.getProposalId(), version.getNumber()),
					json.readValue(version.getSnapshot(), Snapshot.class));
		}
		return snapshots;
	}

	private static ReviewApplicationResponse.Submitted submitted(Snapshot snapshot) {
		Snapshot.Organization organization = snapshot.organization();
		Snapshot.Solution solution = snapshot.solution();
		Snapshot.Materials materials = snapshot.materials();
		return new ReviewApplicationResponse.Submitted(snapshot.applicant().email(), snapshot.applicant().contact(),
				organization.name(), organization.type(), organization.country(), organization.teamSize(),
				organization.website(), organization.teamBackground(), solution.name(), solution.summary(),
				solution.problemsSolved(), solution.maturity(), solution.demoUrl(), materials.deck(),
				materials.builtWith() == null ? List.of() : materials.builtWith(), materials.traction(),
				snapshot.answers()
					.stream()
					.map(answer -> new ReviewApplicationResponse.Answer(answer.questionId(), answer.label(),
							answer.kind(), answer.value(), answer.file()))
					.toList());
	}

	private static @Nullable String choiceOf(Snapshot snapshot, UUID questionId) {
		return snapshot.answers()
			.stream()
			.filter(answer -> answer.questionId().equals(questionId))
			.map(Snapshot.Answer::value)
			.findFirst()
			.orElse(null);
	}

	private static ProposalException invalid(UUID id) {
		return new ProposalException(ProposalErrorCode.ASSESSMENT_INVALID,
				"Assessment of application " + id + " does not score every criterion from 1 to 5");
	}

	private record VersionKey(UUID proposalId, int number) {
	}

	/** What a submission keeps, as {@link ProposalService} writes it. */
	record Snapshot(Applicant applicant, Organization organization, Solution solution, Materials materials,
			List<Answer> answers) {

		record Applicant(String email, ContactDetails contact) {
		}

		record Organization(UUID id, String name, String type, @Nullable String country, @Nullable String teamSize,
				@Nullable String website, @Nullable String teamBackground) {
		}

		/** @param demoUrl absent from a snapshot taken before submissions kept it, which reads as none */
		record Solution(UUID id, String name, @Nullable String summary, @Nullable String problemsSolved,
				@Nullable String maturity, @Nullable String demoUrl) {
		}

		record Materials(@Nullable AttachedFileResponse deck, @Nullable List<String> builtWith,
				@Nullable String traction) {
		}

		record Answer(UUID questionId, String label, String kind, String value, @Nullable AttachedFileResponse file) {
		}
	}
}
