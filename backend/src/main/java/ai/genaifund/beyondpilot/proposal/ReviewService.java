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

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.program.ApplicationForm;
import ai.genaifund.beyondpilot.proposal.ReviewAccess.Reviewing;
import ai.genaifund.beyondpilot.proposal.dto.AttachedFileResponse;
import ai.genaifund.beyondpilot.proposal.dto.ContactDetails;
import ai.genaifund.beyondpilot.proposal.dto.CriterionResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationsResponse;
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

	ReviewService(ReviewSetup setup, ReviewAccess access, ProposalRepository proposals,
			ProposalVersionRepository versions, ProposalAssessmentRepository assessments,
			ProposalReviewDecisionRepository decisions, ProposalReleaseRepository releases, IdentityService identity,
			StorageService storage, JsonMapper json) {
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
	 * A file of an application's last submission, its deck or a file it answered with.
	 * @throws ProposalException when there is no such submitted application, the caller does not review its program, or
	 * the file is not one the submission holds
	 */
	@Transactional
	public FileDownload file(Actor actor, UUID id, UUID fileId) {
		Proposal proposal = submitted(id);
		access.of(actor, proposal.getProgramId());
		Snapshot snapshot = snapshot(proposal);
		boolean held = (snapshot.materials().deck() != null
				&& Objects.requireNonNull(snapshot.materials().deck()).fileId().equals(fileId))
				|| snapshot.answers()
					.stream()
					.anyMatch(answer -> answer.file() != null
							&& Objects.requireNonNull(answer.file()).fileId().equals(fileId));
		if (!held) {
			throw new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND,
					"File " + fileId + " is not of application " + id);
		}
		return storage.download(fileId);
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
				solution.problemsSolved(), solution.maturity(), materials.deck(),
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

		record Solution(UUID id, String name, @Nullable String summary, @Nullable String problemsSolved,
				@Nullable String maturity) {
		}

		record Materials(@Nullable AttachedFileResponse deck, @Nullable List<String> builtWith,
				@Nullable String traction) {
		}

		record Answer(UUID questionId, String label, String kind, String value, @Nullable AttachedFileResponse file) {
		}
	}
}
