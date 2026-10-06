package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.ApplicantOrganization;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationProfile;
import ai.genaifund.beyondpilot.organization.OrganizationService;
import ai.genaifund.beyondpilot.program.ApplicationForm;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.proposal.dto.ApplicantOrganizationRequest;
import ai.genaifund.beyondpilot.proposal.dto.ApplicationMaterialsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ApplicationResponse;
import ai.genaifund.beyondpilot.proposal.dto.ApplicationViewResponse;
import ai.genaifund.beyondpilot.proposal.dto.ApplyingOrganizationResponse;
import ai.genaifund.beyondpilot.proposal.dto.AttachedFileResponse;
import ai.genaifund.beyondpilot.proposal.dto.ContactDetails;
import ai.genaifund.beyondpilot.proposal.dto.FormQuestionResponse;
import ai.genaifund.beyondpilot.proposal.dto.MyApplicationResponse;
import ai.genaifund.beyondpilot.proposal.dto.MyApplicationsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProgramFormResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveApplicationRequest;
import ai.genaifund.beyondpilot.proposal.dto.SolutionOptionResponse;
import ai.genaifund.beyondpilot.proposal.persistence.Proposal;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalVersion;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalVersionRepository;
import ai.genaifund.beyondpilot.solution.OfferedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * What a person does with their application to a program. A save keeps whatever the form holds, so a draft can be
 * left and resumed; a submission checks that everything the program asks is there and keeps a version of it. Nothing
 * waits for GenAI Fund's review of the applicant's organization or solution.
 */
@Service
public class ProposalService {

	private static final Logger LOG = LoggerFactory.getLogger(ProposalService.class);

	/** The longest answers the form takes when a question does not say. */
	private static final int SHORT_TEXT = 300;

	private static final int LONG_TEXT = 2000;

	private static final int LINK = 500;

	private static final Pattern WEB_ADDRESS = Pattern.compile("^https://\\S+$");

	private static final TypeReference<Map<String, String>> ANSWERS = new TypeReference<>() {
	};

	private final ProposalRepository proposals;

	private final ProposalVersionRepository versions;

	private final ProgramService programs;

	private final OrganizationDirectory organizations;

	private final OrganizationService organizationService;

	private final SolutionDirectory solutions;

	private final StorageService storage;

	private final IdentityService identity;

	private final ApplicationEventPublisher events;

	private final JsonMapper json;

	ProposalService(ProposalRepository proposals, ProposalVersionRepository versions, ProgramService programs,
			OrganizationDirectory organizations, OrganizationService organizationService, SolutionDirectory solutions,
			StorageService storage, IdentityService identity, ApplicationEventPublisher events, JsonMapper json) {
		this.proposals = proposals;
		this.versions = versions;
		this.programs = programs;
		this.organizations = organizations;
		this.organizationService = organizationService;
		this.solutions = solutions;
		this.storage = storage;
		this.identity = identity;
		this.events = events;
		this.json = json;
	}

	/**
	 * The application form of a program for the caller: the program's questions, the caller's application if they
	 * saved one, their organization and its solutions.
	 * @throws ProposalException when the program takes no applications on BeyondPilot
	 */
	@Transactional(readOnly = true)
	public ApplicationViewResponse view(Actor actor, String slug) {
		identity.requireActive(actor);
		ApplicationForm form = programs.applicationForm(slug).orElseThrow(() -> notOpen(slug));
		return view(actor, form, proposals.findByProgramIdAndAccountId(form.programId(), actor.accountId()).orElse(null));
	}

	/**
	 * One of the caller's applications with its form.
	 * @throws ProposalException when the caller has no such application, or its program no longer takes applications
	 */
	@Transactional(readOnly = true)
	public ApplicationViewResponse view(Actor actor, UUID id) {
		identity.requireActive(actor);
		Proposal proposal = proposals.findById(id)
			.filter(found -> found.getAccountId().equals(actor.accountId()))
			.orElseThrow(() -> notFound(id));
		return view(actor, formOf(proposal), proposal);
	}

	/** The caller's applications, the most recently changed first. */
	@Transactional(readOnly = true)
	public MyApplicationsResponse mine(Actor actor) {
		identity.requireActive(actor);
		List<Proposal> mine = proposals.findByAccountIdOrderByUpdatedAtDesc(actor.accountId());
		Map<UUID, ApplicationForm> forms = programs
			.applicationForms(mine.stream().map(Proposal::getProgramId).distinct().toList());
		List<MyApplicationResponse> items = new ArrayList<>();
		for (Proposal proposal : mine) {
			ApplicationForm form = forms.get(proposal.getProgramId());
			if (form == null) {
				// A program taken off the site no longer shows its applications to applicants.
				continue;
			}
			UUID organizationId = proposal.getOrganizationId();
			UUID solutionId = proposal.getSolutionId();
			items.add(new MyApplicationResponse(proposal.getId(), form.slug(), form.name(), form.closesAt(),
					form.outcomesDueOn(), proposal.getStatus(),
					organizationId == null ? null
							: organizations.profile(organizationId).map(OrganizationProfile::name).orElse(null),
					solutionId == null ? null : solutions.offered(solutionId).map(OfferedSolution::name).orElse(null),
					proposal.getSubmittedAt(), proposal.getUpdatedAt()));
		}
		return new MyApplicationsResponse(items);
	}

	/**
	 * Keeps what the application form holds, making the application on its first save. Answers are checked against
	 * their questions, but nothing is required until the application is submitted.
	 * @throws ProposalException when the program takes no applications now, the application changed since the form
	 * read it, it was submitted to a program that takes no changes, the solution is not the organization's, or an
	 * answer does not fit its question
	 */
	@Transactional
	public ApplicationViewResponse save(Actor actor, String slug, SaveApplicationRequest request) {
		identity.requireActive(actor);
		ApplicationForm form = open(slug);
		Proposal proposal = proposals.findForUpdate(form.programId(), actor.accountId()).orElse(null);
		if (proposal == null) {
			proposal = new Proposal(UUID.randomUUID(), form.programId(), actor.accountId());
		}
		else {
			if (request.version() == null || proposal.getVersion() != request.version()) {
				throw new ProposalException(ProposalErrorCode.CHANGED_MEANWHILE, "Save of application "
						+ proposal.getId() + " at version " + request.version() + ", which is at " + proposal.getVersion());
			}
			requireChangeable(form, proposal);
		}
		Membership membership = organizations.membershipOf(actor).orElse(null);
		UUID solutionId = request.solutionId();
		if (solutionId != null) {
			ownSolution(membership, solutionId);
		}
		Map<String, String> answers = answers(actor, form, request.answers(), read(proposal.getAnswers()));
		UUID deck = request.deckFileId();
		if (deck != null && !deck.equals(proposal.getDeckFileId())) {
			// A deck is one the applicant uploaded for an application; one an earlier application named is theirs too.
			storage.stored(deck, FilePurpose.APPLICATION_FILE, actor);
		}
		proposal.write(json.writeValueAsString(request.contact()), text(request.teamBackground()),
				membership == null ? null : membership.organizationId(), solutionId, deck,
				request.builtWith().stream().map(String::strip).distinct().toList(), text(request.traction()),
				json.writeValueAsString(answers));
		proposals.saveAndFlush(proposal);
		return view(actor, form, proposal);
	}

	/**
	 * Makes the organization the caller applies through when they belong to none: themselves, or their team. It waits
	 * for GenAI Fund's review, which does not hold up the application.
	 * @throws ProposalException when the program takes no applications now or the caller already belongs to an
	 * organization
	 */
	@Transactional
	public ApplicationViewResponse organize(Actor actor, String slug, ApplicantOrganizationRequest request) {
		identity.requireActive(actor);
		ApplicationForm form = open(slug);
		if (organizations.membershipOf(actor).isPresent()) {
			throw new ProposalException(ProposalErrorCode.ALREADY_IN_ORGANIZATION,
					"Account " + actor.accountId() + " already belongs to an organization");
		}
		boolean individual = "individual".equals(request.kind());
		UUID organizationId = organizationService.createForApplicant(actor,
				new ApplicantOrganization(request.name().strip(), individual ? "independent_builder" : "builder_team",
						request.country(), individual ? "just_me" : Objects.requireNonNullElse(request.teamSize(), "2_9"),
						text(request.website())));
		Proposal proposal = proposals.findForUpdate(form.programId(), actor.accountId()).orElse(null);
		if (proposal != null) {
			proposal.belongTo(organizationId);
			proposals.flush();
		}
		return view(actor, form, proposal);
	}

	/**
	 * Submits the application as its form holds it, or submits it again with its changes. The submission keeps a
	 * version of who applied, with what and what they answered, and a copy goes to the applicant by email.
	 * @throws ProposalException when the caller has no such application, the program's applications have closed, the
	 * application was submitted to a program that takes no changes, or it lacks what a submission needs
	 */
	@Transactional
	public ApplicationViewResponse submit(Actor actor, UUID id) {
		Person person = identity.person(actor);
		Proposal proposal = proposals.findForUpdate(id)
			.filter(found -> found.getAccountId().equals(actor.accountId()))
			.orElseThrow(() -> notFound(id));
		ApplicationForm form = formOf(proposal);
		requireOpen(form);
		requireChangeable(form, proposal);

		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> refused(ProposalErrorCode.ORGANIZATION_REQUIRED, id));
		OrganizationProfile organization = organizations.profile(membership.organizationId())
			.orElseThrow(() -> refused(ProposalErrorCode.ORGANIZATION_REQUIRED, id));
		ContactDetails contact = json.readValue(proposal.getContact(), ContactDetails.class);
		if (blank(contact.firstName()) || blank(contact.lastName()) || blank(contact.phone())
				|| blank(contact.country()) || blank(contact.linkedin())) {
			throw refused(ProposalErrorCode.CONTACT_INCOMPLETE, id);
		}
		boolean alone = "independent_builder".equals(organization.type());
		if (!alone && blank(proposal.getTeamBackground())) {
			throw refused(ProposalErrorCode.TEAM_BACKGROUND_REQUIRED, id);
		}
		UUID solutionId = proposal.getSolutionId();
		if (solutionId == null) {
			throw refused(ProposalErrorCode.SOLUTION_REQUIRED, id);
		}
		OfferedSolution solution = ownSolution(membership, solutionId);
		if (!complete(solution)) {
			throw refused(ProposalErrorCode.SOLUTION_INCOMPLETE, id);
		}
		if (proposal.getDeckFileId() == null) {
			throw refused(ProposalErrorCode.DECK_REQUIRED, id);
		}
		Map<String, String> answers = read(proposal.getAnswers());
		for (ApplicationForm.Question question : form.questions()) {
			if (question.required() && blank(answers.get(question.id().toString()))) {
				throw refused(ProposalErrorCode.ANSWER_REQUIRED, id);
			}
		}
		if (proposals.existsByProgramIdAndOrganizationIdAndStatusAndAccountIdNot(form.programId(), organization.id(),
				Proposal.SUBMITTED, actor.accountId())) {
			throw refused(ProposalErrorCode.ORGANIZATION_APPLIED, id);
		}

		Instant now = Instant.now();
		proposal.belongTo(organization.id());
		int number = proposal.submit(now);
		versions.save(new ProposalVersion(proposal.getId(), number, now,
				json.writeValueAsString(snapshot(person, contact, organization, solution, proposal, form, answers))));
		proposals.flush();
		events.publishEvent(new ProposalSubmitted(proposal.getId(), form.programId(), organization.id(), number,
				person.email(), form.name(), form.allowUpdatesUntilClose() ? form.closesAt() : null));
		LOG.atInfo()
			.addKeyValue("event", "proposal.submission.accepted")
			.addKeyValue("proposal_id", proposal.getId())
			.addKeyValue("program_id", form.programId())
			.addKeyValue("version", number)
			.log("Application submitted");
		return view(actor, form, proposal);
	}

	/**
	 * Withdraws a submitted application before the close. It can be changed and submitted again while the program
	 * still takes applications.
	 * @throws ProposalException when the caller has no such application, it is not submitted, or the applications
	 * have closed
	 */
	@Transactional
	public ApplicationViewResponse withdraw(Actor actor, UUID id) {
		identity.requireActive(actor);
		Proposal proposal = proposals.findForUpdate(id)
			.filter(found -> found.getAccountId().equals(actor.accountId()))
			.orElseThrow(() -> notFound(id));
		ApplicationForm form = formOf(proposal);
		requireOpen(form);
		if (!proposal.isSubmitted()) {
			throw refused(ProposalErrorCode.NOT_SUBMITTED, id);
		}
		proposal.withdraw(Instant.now());
		proposals.flush();
		LOG.atInfo()
			.addKeyValue("event", "proposal.withdrawal.accepted")
			.addKeyValue("proposal_id", id)
			.log("Application withdrawn");
		return view(actor, form, proposal);
	}

	/**
	 * The answers a save keeps: those to the program's questions, each fitting its question. A new file must be one the
	 * caller uploaded for an application; one the application already names stays.
	 */
	private Map<String, String> answers(Actor actor, ApplicationForm form, Map<UUID, String> given,
			Map<String, String> kept) {
		Map<String, String> answers = new LinkedHashMap<>();
		for (ApplicationForm.Question question : form.questions()) {
			String key = question.id().toString();
			String value = given.get(question.id());
			if (value == null || value.isBlank()) {
				continue;
			}
			String answer = switch (question.kind()) {
				case "single_choice" -> question.options().contains(value) ? value : null;
				case "confirm" -> "true".equals(value) ? value : null;
				case "link" -> value.strip().length() <= LINK && WEB_ADDRESS.matcher(value.strip()).matches()
						? value.strip() : null;
				case "file" -> file(actor, value, kept.get(key));
				default -> value.strip().length() <= maxLength(question) ? value.strip() : null;
			};
			if (answer == null) {
				throw new ProposalException(ProposalErrorCode.ANSWER_INVALID,
						"Answer to question " + question.id() + " of program " + form.programId() + " does not fit it");
			}
			answers.put(key, answer);
		}
		return answers;
	}

	private @Nullable String file(Actor actor, String value, @Nullable String kept) {
		if (value.equals(kept)) {
			return value;
		}
		try {
			return storage.stored(UUID.fromString(value), FilePurpose.APPLICATION_FILE, actor).id().toString();
		}
		catch (IllegalArgumentException malformed) {
			return null;
		}
	}

	private static int maxLength(ApplicationForm.Question question) {
		Integer max = question.maxLength();
		return max != null ? max : "short_text".equals(question.kind()) ? SHORT_TEXT : LONG_TEXT;
	}

	private ApplicationViewResponse view(Actor actor, ApplicationForm form, @Nullable Proposal proposal) {
		Person person = identity.person(actor);
		OrganizationProfile organization = organizations.membershipOf(actor)
			.flatMap(membership -> organizations.profile(membership.organizationId()))
			.orElse(null);
		List<SolutionOptionResponse> offered = organization == null ? List.of()
				: solutions.offeredBy(organization.id()).stream().map(this::option).toList();
		// What the person's latest other application held starts a new one.
		ApplicationMaterialsResponse previous = proposal != null ? null
				: proposals.findByAccountIdOrderByUpdatedAtDesc(actor.accountId())
					.stream()
					.findFirst()
					.map(other -> new ApplicationMaterialsResponse(
							json.readValue(other.getContact(), ContactDetails.class), deck(other), other.getBuiltWith(),
							other.getTraction()))
					.orElse(null);
		return new ApplicationViewResponse(program(form), proposal == null ? null : application(form, proposal),
				person.email(), previous,
				organization == null ? null
						: new ApplyingOrganizationResponse(organization.id(), organization.name(), organization.type(),
								organization.country(), organization.teamSize(), organization.approved()),
				offered);
	}

	private static ProgramFormResponse program(ApplicationForm form) {
		return new ProgramFormResponse(form.programId(), form.slug(), form.name(), form.opensAt(), form.closesAt(),
				form.outcomesDueOn(), form.allowUpdatesUntilClose(), form.openAt(Instant.now()),
				form.questions()
					.stream()
					.map(question -> new FormQuestionResponse(question.id(), question.kind(), question.label(),
							question.help(), question.required(), question.options(),
							"link".equals(question.kind()) ? LINK : maxLength(question)))
					.toList());
	}

	private ApplicationResponse application(ApplicationForm form, Proposal proposal) {
		Map<String, String> answers = read(proposal.getAnswers());
		Map<String, AttachedFileResponse> files = new LinkedHashMap<>();
		for (ApplicationForm.Question question : form.questions()) {
			String value = answers.get(question.id().toString());
			if ("file".equals(question.kind()) && value != null) {
				attached(UUID.fromString(value)).ifPresent(file -> files.put(question.id().toString(), file));
			}
		}
		return new ApplicationResponse(proposal.getId(), proposal.getStatus(),
				json.readValue(proposal.getContact(), ContactDetails.class), proposal.getTeamBackground(),
				proposal.getSolutionId(), deck(proposal), proposal.getBuiltWith(), proposal.getTraction(), answers, files, proposal.getSubmissions(), proposal.getSubmittedAt(),
				proposal.getWithdrawnAt(), proposal.getVersion(), proposal.getUpdatedAt());
	}

	private SolutionOptionResponse option(OfferedSolution solution) {
		return new SolutionOptionResponse(solution.id(), solution.name(), solution.summary(),
				solution.problemsSolved(), solution.maturity(), complete(solution));
	}

	private @Nullable AttachedFileResponse deck(Proposal proposal) {
		UUID deck = proposal.getDeckFileId();
		return deck == null ? null : attached(deck).orElse(null);
	}

	private Optional<AttachedFileResponse> attached(UUID fileId) {
		return storage.describe(fileId).map(file -> new AttachedFileResponse(file.id(), file.fileName(), file.sizeBytes()));
	}

	/** What a submission keeps: who applied, for which organization, with which solution, and what they answered. */
	private Map<String, Object> snapshot(Person person, ContactDetails contact, OrganizationProfile organization,
			OfferedSolution solution, Proposal proposal, ApplicationForm form, Map<String, String> answers) {
		Map<String, Object> snapshot = new LinkedHashMap<>();
		snapshot.put("applicant", Map.of("email", person.email(), "contact", contact));
		Map<String, Object> organizationCopy = new LinkedHashMap<>();
		organizationCopy.put("id", organization.id());
		organizationCopy.put("name", organization.name());
		organizationCopy.put("type", organization.type());
		organizationCopy.put("country", organization.country());
		organizationCopy.put("teamSize", organization.teamSize());
		organizationCopy.put("website", organization.website());
		organizationCopy.put("teamBackground", proposal.getTeamBackground());
		snapshot.put("organization", organizationCopy);
		Map<String, Object> solutionCopy = new LinkedHashMap<>();
		solutionCopy.put("id", solution.id());
		solutionCopy.put("name", solution.name());
		solutionCopy.put("summary", solution.summary());
		solutionCopy.put("problemsSolved", solution.problemsSolved());
		solutionCopy.put("maturity", solution.maturity());
		snapshot.put("solution", solutionCopy);
		Map<String, Object> materials = new LinkedHashMap<>();
		materials.put("deck", deck(proposal));
		materials.put("builtWith", proposal.getBuiltWith());
		materials.put("traction", proposal.getTraction());
		snapshot.put("materials", materials);
		List<Map<String, Object>> answered = new ArrayList<>();
		for (ApplicationForm.Question question : form.questions()) {
			String value = answers.get(question.id().toString());
			if (value == null) {
				continue;
			}
			Map<String, Object> answer = new LinkedHashMap<>();
			answer.put("questionId", question.id());
			answer.put("label", question.label());
			answer.put("kind", question.kind());
			answer.put("value", value);
			if ("file".equals(question.kind())) {
				answer.put("file", attached(UUID.fromString(value)).orElse(null));
			}
			answered.add(answer);
		}
		snapshot.put("answers", answered);
		return snapshot;
	}

	private static boolean complete(OfferedSolution solution) {
		return !blank(solution.summary()) && !blank(solution.problemsSolved()) && solution.maturity() != null;
	}

	private OfferedSolution ownSolution(@Nullable Membership membership, UUID solutionId) {
		return solutions.offered(solutionId)
			.filter(found -> membership != null && found.organizationId().equals(membership.organizationId()))
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.SOLUTION_NOT_FOUND,
					"Solution " + solutionId + " is not of the applicant's organization"));
	}

	private ApplicationForm open(String slug) {
		ApplicationForm form = programs.applicationForm(slug).orElseThrow(() -> notOpen(slug));
		requireOpen(form);
		return form;
	}

	private static void requireOpen(ApplicationForm form) {
		Instant now = Instant.now();
		if (!now.isBefore(form.closesAt())) {
			throw new ProposalException(ProposalErrorCode.CLOSED, "Applications to " + form.slug() + " closed");
		}
		if (now.isBefore(form.opensAt())) {
			throw notOpen(form.slug());
		}
	}

	private static void requireChangeable(ApplicationForm form, Proposal proposal) {
		if (proposal.isSubmitted() && !form.allowUpdatesUntilClose()) {
			throw new ProposalException(ProposalErrorCode.LOCKED,
					"Change of submitted application " + proposal.getId() + " to " + form.slug());
		}
	}

	private ApplicationForm formOf(Proposal proposal) {
		ApplicationForm form = programs.applicationForms(List.of(proposal.getProgramId())).get(proposal.getProgramId());
		if (form == null) {
			throw notFound(proposal.getId());
		}
		return form;
	}

	private Map<String, String> read(String answers) {
		return json.readValue(answers, ANSWERS);
	}

	private static boolean blank(@Nullable String value) {
		return value == null || value.isBlank();
	}

	private static @Nullable String text(@Nullable String value) {
		return blank(value) ? null : Objects.requireNonNull(value).strip();
	}

	private static ProposalException notOpen(String slug) {
		return new ProposalException(ProposalErrorCode.NOT_OPEN, "No application form at " + slug);
	}

	private static ProposalException notFound(UUID id) {
		return new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND, "No application " + id + " of this caller");
	}

	private static ProposalException refused(ProposalErrorCode code, UUID id) {
		return new ProposalException(code, "Submission of application " + id + " refused: " + code.code());
	}
}
