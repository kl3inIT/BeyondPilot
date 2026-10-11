package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.proposal.dto.AttachedFileResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposalSolutionResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposalTeamMemberResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposalUseCaseResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposingOrganizationResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalSummaryResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalsResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveUseCaseProposalRequest;
import ai.genaifund.beyondpilot.proposal.dto.SenderProfileResponse;
import ai.genaifund.beyondpilot.proposal.dto.TeamCandidateResponse;
import ai.genaifund.beyondpilot.proposal.dto.TeamMemberRequest;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalCountResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalCountsResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalFormResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalResponse;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposal;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalMember;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalMemberRepository;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalSolution;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalSolutionRepository;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.talent.TalentSnapshot;
import ai.genaifund.beyondpilot.talent.TalentSnapshots;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import ai.genaifund.beyondpilot.usecase.UseCaseTarget;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * What an organization does with its proposal to a use case. The members of an approved organization keep one working
 * copy of it, which a save changes until it is sent; sending checks everything again and keeps the sender's talent
 * profile as it was. The members of the organization that posted the use case read what was sent. Nothing here is a
 * program application: that is {@link ProposalService}.
 */
@Service
public class UseCaseProposals {

	private static final Logger LOG = LoggerFactory.getLogger(UseCaseProposals.class);

	/** The most use cases one count asks about. */
	public static final int MOST_COUNTED = 50;

	private final UseCaseProposalRepository proposals;

	private final UseCaseProposalMemberRepository teams;

	private final UseCaseProposalSolutionRepository offers;

	private final UseCaseDirectory useCases;

	private final OrganizationDirectory organizations;

	private final SolutionDirectory solutions;

	private final TalentSnapshots talent;

	private final IdentityService identity;

	private final StorageService storage;

	private final JsonMapper json;

	UseCaseProposals(UseCaseProposalRepository proposals, UseCaseProposalMemberRepository teams,
			UseCaseProposalSolutionRepository offers, UseCaseDirectory useCases, OrganizationDirectory organizations, SolutionDirectory solutions,
			TalentSnapshots talent, IdentityService identity, StorageService storage, JsonMapper json) {
		this.proposals = proposals;
		this.teams = teams;
		this.offers = offers;
		this.useCases = useCases;
		this.organizations = organizations;
		this.solutions = solutions;
		this.talent = talent;
		this.identity = identity;
		this.storage = storage;
		this.json = json;
	}

	/**
	 * The form for the caller: the use case, their organization with its members, and their
	 * organization's proposal when one was saved.
	 * @throws ProposalException when the use case is unknown, or no longer takes proposals and the caller's organization
	 * sent none, or the caller's organization posted it
	 */
	@Transactional(readOnly = true)
	public UseCaseProposalFormResponse form(Actor actor, UUID useCaseId) {
		identity.requireActive(actor);
		UseCaseTarget target = known(useCaseId);
		Membership membership = organizations.membershipOf(actor).orElse(null);
		requireNotOwn(target, membership);
		if (!target.open()) {
			// A use case that no longer takes proposals still shows the caller the one their organization sent.
			UseCaseProposal sent = membership == null ? null
					: proposals.findByUseCaseIdAndOrganizationId(useCaseId, membership.organizationId())
						.filter(UseCaseProposal::isSent)
						.orElse(null);
			if (sent == null) {
				throw closed(useCaseId);
			}
			return form(actor, target, membership, sent);
		}
		return form(actor, target, membership);
	}

	/**
	 * Keeps what the form holds, making the proposal on the first save. A draft may be partial; it may offer solutions of the organization, whatever their review says, each once; the team may name only
	 * members of the organization, each once, with at most one primary contact.
	 * @throws ProposalException when the use case no longer takes proposals, the caller has no approved organization
	 * or it posted the use case, the proposal was sent or changed since the form read it, or something does not fit
	 */
	@Transactional
	public UseCaseProposalFormResponse save(Actor actor, UUID useCaseId, SaveUseCaseProposalRequest request) {
		identity.requireActive(actor);
		UseCaseTarget target = known(useCaseId);
		Membership membership = approved(actor, target);
		UUID organizationId = membership.organizationId();

		UseCaseProposal proposal = proposals.findForUpdate(useCaseId, organizationId).orElse(null);
		boolean created = proposal == null;
		boolean edit = false;
		if (proposal == null) {
			requireOpen(target);
			proposal = new UseCaseProposal(UUID.randomUUID(), useCaseId, organizationId, actor.accountId());
		}
		else {
			if (request.version() == null || proposal.getVersion() != request.version()) {
				throw new ProposalException(ProposalErrorCode.CHANGED_MEANWHILE, "Save of proposal " + proposal.getId()
						+ " at version " + request.version() + ", which is at " + proposal.getVersion());
			}
			edit = proposal.isSent();
			if (!edit) {
				requireOpen(target);
			}
			else {
				if (editableUntil(proposal, target) == null) {
					throw new ProposalException(ProposalErrorCode.EDIT_WINDOW_CLOSED,
							"Save of sent proposal " + proposal.getId() + ", whose time to edit has ended");
				}
				UUID primaryNamed = request.team()
					.stream()
					.filter(TeamMemberRequest::primary)
					.map(TeamMemberRequest::accountId)
					.findFirst()
					.orElse(null);
				requireComplete(proposal.getId(), !request.solutionIds().isEmpty(), request.approach(),
						request.deckFileId(), request.team().stream().map(TeamMemberRequest::accountId).toList(),
						request.team().stream().map(TeamMemberRequest::role).toList(), primaryNamed);
			}
		}

		List<UseCaseProposalSolution> offered = offered(proposal.getId(), membership, request.solutionIds());
		UUID deck = request.deckFileId();
		if (deck != null && !deck.equals(proposal.getDeckFileId())) {
			// A new PDF is one the caller uploaded for an application; the one the proposal names stays.
			storage.stored(deck, FilePurpose.APPLICATION_FILE, actor);
		}
		List<UseCaseProposalMember> team = team(proposal.getId(), organizationId, request.team());
		UUID primary = request.team().stream().filter(TeamMemberRequest::primary).map(TeamMemberRequest::accountId)
			.findFirst().orElse(null);

		if (!created) {
			teams.deleteAllOf(proposal.getId());
			offers.deleteAllOf(proposal.getId());
			// The delete runs as its own statement; the proposal is read again, still locked, and written.
			proposal = proposals.findForUpdate(proposal.getId()).orElseThrow();
		}
		if (edit) {
			proposal.edit(text(request.approach()), deck, primary, Instant.now());
		}
		else {
			proposal.write(text(request.approach()), deck, primary, Instant.now());
		}
		proposals.saveAndFlush(proposal);
		teams.saveAll(team);
		offers.saveAll(offered);
		teams.flush();
		offers.flush();
		return form(actor, target, membership, proposal);
	}

	/**
	 * Sends the proposal as it was saved: it is checked again, and the sender's talent profile is kept with it.
	 * @throws ProposalException when the caller has no such proposal, it was sent, the use case no longer takes
	 * proposals, or it lacks what a proposal needs; the code says what
	 */
	@Transactional
	public UseCaseProposalFormResponse send(Actor actor, UUID id) {
		identity.requireActive(actor);
		UseCaseProposal proposal = proposals.findForUpdate(id).orElseThrow(() -> notFound(id));
		Membership membership = organizations.membershipOf(actor)
			.filter(found -> found.organizationId().equals(proposal.getOrganizationId()))
			.orElseThrow(() -> notFound(id));
		UseCaseTarget target = open(proposal.getUseCaseId());
		approved(actor, target);
		if (proposal.isSent()) {
			throw refused(ProposalErrorCode.ALREADY_SENT, id);
		}

		List<UseCaseProposalMember> team = teams.findByProposalIdOrderByPosition(id);
		requireComplete(id, !offers.findByProposalIdOrderByPosition(id).isEmpty(), proposal.getApproach(),
				proposal.getDeckFileId(), team.stream().map(UseCaseProposalMember::getAccountId).toList(),
				team.stream().map(UseCaseProposalMember::getRole).toList(), proposal.getPrimaryContactAccountId());
		Set<UUID> members = Set.copyOf(organizations.memberAccountIds(membership.organizationId()));
		if (!team.stream().allMatch(member -> members.contains(member.getAccountId()))) {
			throw refused(ProposalErrorCode.TEAM_INVALID, id);
		}
		TalentSnapshot profile = talent.of(actor.accountId())
			.filter(TalentSnapshot::complete)
			.orElseThrow(() -> refused(ProposalErrorCode.PROFILE_INCOMPLETE, id));

		Instant now = Instant.now();
		proposal.send(actor.accountId(), json.writeValueAsString(sender(profile)), now);
		proposals.saveAndFlush(proposal);
		LOG.atInfo()
			.addKeyValue("event", "proposal.use_case.sent")
			.addKeyValue("proposal_id", id)
			.addKeyValue("use_case_id", proposal.getUseCaseId())
			.addKeyValue("organization_id", proposal.getOrganizationId())
			.log("Proposal sent to a use case");
		return form(actor, target, membership, proposal);
	}

	/**
	 * The proposals a use case received, for the members of the organization that posted it.
	 * @throws ProposalException when the use case is unknown or the caller's organization did not post it
	 */
	@Transactional(readOnly = true)
	public ReceivedUseCaseProposalsResponse received(Actor actor, UUID useCaseId) {
		identity.requireActive(actor);
		UseCaseTarget target = posted(actor, useCaseId);
		List<UseCaseProposal> sent = proposals.findByUseCaseIdAndStatusOrderBySentAtDesc(useCaseId,
				UseCaseProposal.SENT);
		Map<UUID, OrganizationName> names = organizations
			.names(sent.stream().map(UseCaseProposal::getOrganizationId).distinct().toList());
		Map<UUID, List<UseCaseProposalSolution>> offeredBy = offersOf(sent);
		Map<UUID, List<UseCaseProposalMember>> teamsOf = teamsOf(sent);
		Map<UUID, Person> people = identity.people(teamsOf.values()
			.stream()
			.flatMap(List::stream)
			.map(UseCaseProposalMember::getAccountId)
			.distinct()
			.toList());
		List<ReceivedUseCaseProposalSummaryResponse> items = sent.stream().map(proposal -> {
			OrganizationName organization = names.get(proposal.getOrganizationId());
			List<String> solutionNames = solutionsOf(offeredBy.getOrDefault(proposal.getId(), List.of())).stream()
				.map(ProposalSolutionResponse::name)
				.toList();
			Person contact = proposal.getPrimaryContactAccountId() == null ? null
					: people.get(proposal.getPrimaryContactAccountId());
			return new ReceivedUseCaseProposalSummaryResponse(proposal.getId(),
					organization == null ? "" : organization.name(),
					organization == null ? null : organization.logoFileId(), solutionNames,
					contact == null ? null : label(contact), Objects.requireNonNull(proposal.getSentAt()),
					proposal.getEditedAt());
		}).toList();
		return new ReceivedUseCaseProposalsResponse(useCase(target), items);
	}

	/**
	 * One proposal a use case received.
	 * @throws ProposalException when the proposal was not sent, or the caller's organization did not post its use case
	 */
	@Transactional(readOnly = true)
	public ReceivedUseCaseProposalResponse receivedOne(Actor actor, UUID id) {
		identity.requireActive(actor);
		UseCaseProposal proposal = readable(actor, id);
		UseCaseTarget target = useCases.target(proposal.getUseCaseId()).orElseThrow(() -> notFound(id));
		OrganizationName organization = organizations.names(List.of(proposal.getOrganizationId()))
			.get(proposal.getOrganizationId());
		SenderProfileResponse sender = senderOf(proposal);
		return new ReceivedUseCaseProposalResponse(proposal.getId(), useCase(target),
				organization == null ? "" : organization.name(), organization == null ? null : organization.logoFileId(),
				solutions(proposal),
				proposal.getApproach(), sender, team(proposal), deck(proposal),
				Objects.requireNonNull(proposal.getSentAt()), proposal.getEditedAt());
	}

	/**
	 * The PDF of a proposal a use case received.
	 * @throws ProposalException when the proposal was not sent, or the caller's organization did not post its use case
	 */
	@Transactional(readOnly = true)
	public FileDownload file(Actor actor, UUID id) {
		identity.requireActive(actor);
		UseCaseProposal proposal = readable(actor, id);
		UUID deck = proposal.getDeckFileId();
		if (deck == null) {
			throw notFound(id);
		}
		return storage.download(deck);
	}

	/** How many proposals each of these use cases received, for anyone; a use case that received none counts 0. */
	@Transactional(readOnly = true)
	public UseCaseProposalCountsResponse counts(List<UUID> useCaseIds) {
		List<UUID> asked = useCaseIds.stream().distinct().limit(MOST_COUNTED).toList();
		Map<UUID, Long> sent = proposals.countSent(asked)
			.stream()
			.collect(Collectors.toMap(UseCaseProposalRepository.Count::getUseCaseId, UseCaseProposalRepository.Count::getSent));
		return new UseCaseProposalCountsResponse(
				asked.stream().map(id -> new UseCaseProposalCountResponse(id, sent.getOrDefault(id, 0L))).toList());
	}

	private UseCaseTarget open(UUID useCaseId) {
		UseCaseTarget target = known(useCaseId);
		requireOpen(target);
		return target;
	}

	private UseCaseTarget known(UUID useCaseId) {
		return useCases.target(useCaseId)
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.USE_CASE_NOT_FOUND, "No use case " + useCaseId));
	}

	private static void requireOpen(UseCaseTarget target) {
		if (!target.open()) {
			throw closed(target.id());
		}
	}

	private static ProposalException closed(UUID useCaseId) {
		return new ProposalException(ProposalErrorCode.USE_CASE_CLOSED, "Use case " + useCaseId + " takes no proposals");
	}

	/**
	 * Until when a sent proposal may still be edited: its sending time plus the days the use case allows, while the use
	 * case takes proposals. Null for a draft, with no days, once the time has passed, and once the use case has closed.
	 */
	private static @Nullable Instant editableUntil(UseCaseProposal proposal, UseCaseTarget target) {
		Instant sentAt = proposal.getSentAt();
		if (!proposal.isSent() || sentAt == null || !target.open() || target.proposalEditDays() <= 0) {
			return null;
		}
		Instant until = sentAt.plus(target.proposalEditDays(), ChronoUnit.DAYS);
		return until.isAfter(Instant.now()) ? until : null;
	}

	/** What a proposal needs to be sent, and to stay complete when it is edited; the code says what is missing. */
	private static void requireComplete(UUID id, boolean hasSolution, @Nullable String approach, @Nullable UUID deck,
			List<UUID> team, List<String> roles, @Nullable UUID primary) {
		if (!hasSolution) {
			throw refused(ProposalErrorCode.SOLUTION_REQUIRED, id);
		}
		if (blank(approach)) {
			throw refused(ProposalErrorCode.APPROACH_REQUIRED, id);
		}
		if (deck == null) {
			throw refused(ProposalErrorCode.PDF_REQUIRED, id);
		}
		if (team.isEmpty() || primary == null || roles.stream().anyMatch(UseCaseProposals::blank)
				|| !team.contains(primary)) {
			throw refused(ProposalErrorCode.TEAM_INCOMPLETE, id);
		}
	}

	/** The caller's membership, which must be of an approved organization other than the one that posted the use case. */
	private Membership approved(Actor actor, UseCaseTarget target) {
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.NO_ORGANIZATION,
					"Account " + actor.accountId() + " belongs to no organization"));
		if (!membership.approved()) {
			throw new ProposalException(ProposalErrorCode.ORGANIZATION_NOT_APPROVED,
					"Organization " + membership.organizationId() + " is not approved");
		}
		requireNotOwn(target, membership);
		return membership;
	}

	private static void requireNotOwn(UseCaseTarget target, @Nullable Membership membership) {
		if (membership != null && membership.organizationId().equals(target.organizationId())) {
			throw new ProposalException(ProposalErrorCode.OWN_USE_CASE,
					"Organization " + membership.organizationId() + " posted use case " + target.id());
		}
	}

	/** The use case, when the caller belongs to the organization that posted it. */
	private UseCaseTarget posted(Actor actor, UUID useCaseId) {
		UseCaseTarget target = useCases.target(useCaseId)
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.USE_CASE_NOT_FOUND, "No use case " + useCaseId));
		organizations.membershipOf(actor)
			.filter(membership -> membership.organizationId().equals(target.organizationId()))
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.USE_CASE_NOT_FOUND,
					"Account " + actor.accountId() + " is not of the organization that posted use case " + useCaseId));
		return target;
	}

	/** A sent proposal of a use case the caller's organization posted. */
	private UseCaseProposal readable(Actor actor, UUID id) {
		UseCaseProposal proposal = proposals.findById(id).filter(UseCaseProposal::isSent).orElseThrow(() -> notFound(id));
		posted(actor, proposal.getUseCaseId());
		return proposal;
	}

	private UseCaseProposalFormResponse form(Actor actor, UseCaseTarget target, @Nullable Membership membership) {
		UseCaseProposal proposal = membership == null ? null
				: proposals.findByUseCaseIdAndOrganizationId(target.id(), membership.organizationId()).orElse(null);
		return form(actor, target, membership, proposal);
	}

	private UseCaseProposalFormResponse form(Actor actor, UseCaseTarget target, @Nullable Membership membership,
			@Nullable UseCaseProposal proposal) {
		if (membership == null) {
			return new UseCaseProposalFormResponse(useCase(target), null, List.of(), null);
		}
		UUID organizationId = membership.organizationId();
		OrganizationName name = organizations.names(List.of(organizationId)).get(organizationId);
		List<UUID> memberIds = organizations.memberAccountIds(organizationId);
		Map<UUID, Person> people = identity.people(memberIds);
		List<TeamCandidateResponse> members = memberIds.stream()
			.map(people::get)
			.filter(Objects::nonNull)
			.map(person -> new TeamCandidateResponse(person.accountId(), person.displayName(), person.email(),
					person.accountId().equals(actor.accountId())))
			.sorted(Comparator.comparing(candidate -> label(candidate.name(), candidate.email()).toLowerCase()))
			.toList();
		return new UseCaseProposalFormResponse(useCase(target),
				new ProposingOrganizationResponse(organizationId, membership.organizationName(),
						name == null ? null : name.logoFileId(), membership.approved()),
				members, proposal == null ? null : response(proposal, target));
	}

	private UseCaseProposalResponse response(UseCaseProposal proposal, UseCaseTarget target) {
		return new UseCaseProposalResponse(proposal.getId(), proposal.getStatus(), solutions(proposal),
				proposal.getApproach(), deck(proposal), team(proposal), senderOf(proposal), proposal.getSentAt(),
				editableUntil(proposal, target), proposal.getEditedAt(), proposal.getVersion(),
				proposal.getUpdatedAt());
	}

	private @Nullable SenderProfileResponse senderOf(UseCaseProposal proposal) {
		return proposal.getTalent() == null ? null : json.readValue(proposal.getTalent(), SenderProfileResponse.class);
	}

	private List<ProposalTeamMemberResponse> team(UseCaseProposal proposal) {
		List<UseCaseProposalMember> members = teams.findByProposalIdOrderByPosition(proposal.getId());
		Map<UUID, Person> people = identity.people(members.stream().map(UseCaseProposalMember::getAccountId).toList());
		UUID primary = proposal.getPrimaryContactAccountId();
		List<ProposalTeamMemberResponse> team = new ArrayList<>();
		for (UseCaseProposalMember member : members) {
			Person person = people.get(member.getAccountId());
			if (person != null) {
				team.add(new ProposalTeamMemberResponse(member.getAccountId(), person.displayName(), person.email(),
						member.getRole(), member.getAccountId().equals(primary)));
			}
		}
		return team;
	}

	/** The team a save names, checked: members of the organization, each once, at most one primary contact. */
	private List<UseCaseProposalMember> team(UUID proposalId, UUID organizationId, List<TeamMemberRequest> named) {
		Set<UUID> members = Set.copyOf(organizations.memberAccountIds(organizationId));
		Set<UUID> seen = new HashSet<>();
		List<UseCaseProposalMember> team = new ArrayList<>();
		int primaries = 0;
		for (TeamMemberRequest member : named) {
			if (!members.contains(member.accountId()) || !seen.add(member.accountId())) {
				throw new ProposalException(ProposalErrorCode.TEAM_INVALID,
						"Team of proposal " + proposalId + " names " + member.accountId() + ", not once of its organization");
			}
			primaries += member.primary() ? 1 : 0;
			team.add(new UseCaseProposalMember(proposalId, member.accountId(), team.size(), member.role().strip()));
		}
		if (primaries > 1) {
			throw new ProposalException(ProposalErrorCode.TEAM_INVALID, "Team of proposal " + proposalId + " has "
					+ primaries + " primary contacts");
		}
		return team;
	}

	private Map<UUID, List<UseCaseProposalMember>> teamsOf(List<UseCaseProposal> sent) {
		if (sent.isEmpty()) {
			return Map.of();
		}
		return teams.findByProposalIdInOrderByPosition(sent.stream().map(UseCaseProposal::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(UseCaseProposalMember::getProposalId));
	}

	/** The solutions a save names, checked: each once, each of the caller's organization, whatever its review says. */
	private List<UseCaseProposalSolution> offered(UUID proposalId, Membership membership, List<UUID> named) {
		Set<UUID> seen = new HashSet<>();
		List<UseCaseProposalSolution> offered = new ArrayList<>();
		for (UUID solutionId : named) {
			if (!seen.add(solutionId)) {
				throw new ProposalException(ProposalErrorCode.SOLUTION_NOT_FOUND,
						"Proposal " + proposalId + " names solution " + solutionId + " twice");
			}
			solutions.offered(solutionId)
				.filter(found -> found.organizationId().equals(membership.organizationId()))
				.orElseThrow(() -> new ProposalException(ProposalErrorCode.SOLUTION_NOT_FOUND,
						"Solution " + solutionId + " is not of organization " + membership.organizationId()));
			offered.add(new UseCaseProposalSolution(proposalId, solutionId, offered.size()));
		}
		return offered;
	}

	private Map<UUID, List<UseCaseProposalSolution>> offersOf(List<UseCaseProposal> sent) {
		if (sent.isEmpty()) {
			return Map.of();
		}
		return offers.findByProposalIdInOrderByPosition(sent.stream().map(UseCaseProposal::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(UseCaseProposalSolution::getProposalId));
	}

	private List<ProposalSolutionResponse> solutions(UseCaseProposal proposal) {
		return solutionsOf(offers.findByProposalIdOrderByPosition(proposal.getId()));
	}

	private List<ProposalSolutionResponse> solutionsOf(List<UseCaseProposalSolution> offered) {
		return offered.stream()
			.map(offer -> solutions.offered(offer.getSolutionId()))
			.flatMap(Optional::stream)
			.map(solution -> new ProposalSolutionResponse(solution.id(), solution.name(), solution.summary(),
					solution.viewKey(), solution.approved() ? solution.slug() : null, solution.logoFileId()))
			.toList();
	}

	private @Nullable AttachedFileResponse deck(UseCaseProposal proposal) {
		UUID deck = proposal.getDeckFileId();
		return deck == null ? null
				: storage.describe(deck)
					.map(file -> new AttachedFileResponse(file.id(), file.fileName(), file.sizeBytes()))
					.orElse(null);
	}

	private static SenderProfileResponse sender(TalentSnapshot profile) {
		return new SenderProfileResponse(profile.name(), profile.headline(), profile.bio(), profile.roles(),
				profile.skills(), profile.country(), profile.city(), profile.worksAt(), profile.languages(),
				profile.industries(), profile.engagement(), profile.website(), profile.photoFileId(),
				profile.projects()
					.stream()
					.map(project -> new SenderProfileResponse.Project(project.title(), project.summary(), project.url(),
							project.year(), project.stage()))
					.toList());
	}

	private static ProposalUseCaseResponse useCase(UseCaseTarget target) {
		return new ProposalUseCaseResponse(target.id(), target.title(), target.closesAt());
	}

	private static String label(Person person) {
		return label(person.displayName(), person.email());
	}

	private static String label(@Nullable String name, String email) {
		return blank(name) ? email : Objects.requireNonNull(name);
	}

	private static boolean blank(@Nullable String value) {
		return value == null || value.isBlank();
	}

	private static @Nullable String text(@Nullable String value) {
		return blank(value) ? null : Objects.requireNonNull(value).strip();
	}

	private static ProposalException notFound(UUID id) {
		return new ProposalException(ProposalErrorCode.PROPOSAL_NOT_FOUND, "No proposal " + id + " of this caller");
	}

	private static ProposalException refused(ProposalErrorCode code, UUID id) {
		return new ProposalException(code, "Proposal " + id + " refused: " + code.code());
	}
}
