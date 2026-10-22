package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.proposal.dto.AttachedFileResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposalSolutionResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposalUseCaseResponse;
import ai.genaifund.beyondpilot.proposal.dto.ProposingOrganizationResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalSummaryResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalsResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveUseCaseProposalRequest;
import ai.genaifund.beyondpilot.proposal.dto.SenderProfileResponse;
import ai.genaifund.beyondpilot.proposal.dto.SentByResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalCountResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalCountsResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalFormResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalOutcomesResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalResponse;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposal;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalDecision;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalDecisionRepository;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalSolution;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalSolutionRepository;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.storage.StoredFile;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import ai.genaifund.beyondpilot.usecase.UseCaseTarget;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * What an organization does with its proposal to a use case. The members of an organization keep one working
 * copy of it, which a save changes until it is sent (a save needs only a membership of an organization); sending
 * checks everything again and keeps the sender's talent profile as it was. The members of the organization that posted the use case read what was sent. Nothing here is a
 * program application: that is {@link ProposalService}.
 */
@Service
public class UseCaseProposals {

	private static final Logger LOG = LoggerFactory.getLogger(UseCaseProposals.class);

	/** The most use cases one count asks about. */
	public static final int MOST_COUNTED = 50;

	private final UseCaseProposalRepository proposals;

	private final UseCaseProposalSolutionRepository offers;

	private final UseCaseDirectory useCases;

	private final OrganizationDirectory organizations;

	private final SolutionDirectory solutions;

	private final IdentityService identity;

	private final StorageService storage;

	private final JsonMapper json;

	private final EmailService email;

	private final UseCaseProposalDecisionRepository decisions;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	UseCaseProposals(UseCaseProposalRepository proposals, UseCaseProposalSolutionRepository offers,
			UseCaseDirectory useCases, OrganizationDirectory organizations, SolutionDirectory solutions,
			IdentityService identity, StorageService storage, JsonMapper json, EmailService email,
			UseCaseProposalDecisionRepository decisions, AuditTrail audit, ApplicationEventPublisher events) {
		this.proposals = proposals;
		this.offers = offers;
		this.useCases = useCases;
		this.organizations = organizations;
		this.solutions = solutions;
		this.identity = identity;
		this.storage = storage;
		this.json = json;
		this.email = email;
		this.decisions = decisions;
		this.audit = audit;
		this.events = events;
	}

	/**
	 * The form for the caller: the use case, their organization, and their
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
		if (!target.open() || target.challenge() != null) {
			// A use case that takes no new proposals still shows the caller the one their organization sent, or took back.
			UseCaseProposal sent = membership == null ? null
					: proposals.findByUseCaseIdAndOrganizationId(useCaseId, membership.organizationId())
						.filter(found -> found.isSent() || found.getWithdrawnAt() != null)
						.orElse(null);
			if (sent == null) {
				throw target.open() ? inChallenge(target) : closed(useCaseId);
			}
			return form(actor, target, membership, sent);
		}
		return form(actor, target, membership);
	}

	/**
	 * Keeps what the form holds, making the proposal on the first save. A draft may be partial; it may offer solutions of the organization,
	 * whatever their review says, each once.
	 * @throws ProposalException when the use case no longer takes proposals, the caller belongs to no organization
	 * or their organization posted the use case, the proposal was sent or changed since the form read it, or
	 * something does not fit
	 */
	@Transactional
	public UseCaseProposalFormResponse save(Actor actor, UUID useCaseId, SaveUseCaseProposalRequest request) {
		identity.requireActive(actor);
		UseCaseTarget target = known(useCaseId);
		Membership membership = member(actor, target);
		UUID organizationId = membership.organizationId();

		UseCaseProposal proposal = proposals.findForUpdate(useCaseId, organizationId).orElse(null);
		boolean created = proposal == null;
		boolean edit = false;
		if (proposal == null) {
			requireOpenToNew(target);
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
				requireComplete(proposal.getId(), !request.solutionIds().isEmpty(), request.approach(),
						request.deckFileId(), isTeam(membership), request.teamBackground());
			}
		}

		List<UseCaseProposalSolution> offered = offered(proposal.getId(), membership, request.solutionIds());
		UUID deck = request.deckFileId();
		if (deck != null && !deck.equals(proposal.getDeckFileId())) {
			// A new PDF is one the caller uploaded for an application; the one the proposal names stays.
			storage.stored(deck, FilePurpose.APPLICATION_FILE, actor);
		}

		if (!created) {
			offers.deleteAllOf(proposal.getId());
			// The delete runs as its own statement; the proposal is read again, still locked, and written.
			proposal = proposals.findForUpdate(proposal.getId()).orElseThrow();
		}
		if (edit) {
			proposal.edit(text(request.approach()), text(request.teamBackground()), deck, Instant.now());
		}
		else {
			proposal.write(text(request.approach()), text(request.teamBackground()), deck, Instant.now());
		}
		proposals.saveAndFlush(proposal);
		offers.saveAll(offered);
		offers.flush();
		if (edit) {
			events.publishEvent(new UseCaseProposalSent(useCaseId, proposal.getId()));
		}
		return form(actor, target, membership, proposal);
	}

	/**
	 * Sends the proposal as it was saved: it is checked again, and the sender's name, country and number must be given.
	 * @throws ProposalException when the caller has no such proposal, it was sent, the use case no longer takes
	 * proposals, or it lacks what a proposal needs; the code says what
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller has not agreed to share their data
	 * with program partners
	 */
	@Transactional
	public UseCaseProposalFormResponse send(Actor actor, UUID id) {
		identity.requireActive(actor);
		identity.requirePartnersConsent(actor);
		UseCaseProposal proposal = proposals.findForUpdate(id).orElseThrow(() -> notFound(id));
		Membership membership = organizations.membershipOf(actor)
			.filter(found -> found.organizationId().equals(proposal.getOrganizationId()))
			.orElseThrow(() -> notFound(id));
		UseCaseTarget target = open(proposal.getUseCaseId());
		member(actor, target);
		if (proposal.isSent()) {
			throw refused(ProposalErrorCode.ALREADY_SENT, id);
		}

		requireComplete(id, !offers.findByProposalIdOrderByPosition(id).isEmpty(), proposal.getApproach(),
				proposal.getDeckFileId(), isTeam(membership), proposal.getTeamBackground());
		// The submitting identity: the account's name, address, country and number.
		Person sender = identity.person(actor);
		if (blank(sender.displayName()) || blank(sender.country()) || blank(sender.phone())) {
			throw refused(ProposalErrorCode.CONTACT_REQUIRED, id);
		}

		Instant now = Instant.now();
		proposal.send(actor.accountId(), now);
		proposals.saveAndFlush(proposal);
		LOG.atInfo()
			.addKeyValue("event", "proposal.use_case.sent")
			.addKeyValue("proposal_id", id)
			.addKeyValue("use_case_id", proposal.getUseCaseId())
			.addKeyValue("organization_id", proposal.getOrganizationId())
			.log("Proposal sent to a use case");
		events.publishEvent(new UseCaseProposalSent(proposal.getUseCaseId(), id));
		tellSender(actor, proposal, target, membership);
		return form(actor, target, membership, proposal);
	}

	/**
	 * Takes a sent proposal back while its use case still takes proposals: it is a draft again with what it held, the
	 * organization that posted the use case no longer reads it or counts it, and its owner may change it and send it
	 * again. Withdrawing is not bound by the time to edit: it ends only when the use case closes.
	 * @throws ProposalException when the caller has no such proposal, it is not sent, or the use case no longer takes
	 * proposals
	 */
	@Transactional
	public UseCaseProposalFormResponse withdraw(Actor actor, UUID id) {
		identity.requireActive(actor);
		UseCaseProposal proposal = proposals.findForUpdate(id).orElseThrow(() -> notFound(id));
		Membership membership = organizations.membershipOf(actor)
			.filter(found -> found.organizationId().equals(proposal.getOrganizationId()))
			.orElseThrow(() -> notFound(id));
		UseCaseTarget target = known(proposal.getUseCaseId());
		if (!proposal.isSent()) {
			throw refused(ProposalErrorCode.NOT_SENT, id);
		}
		requireOpen(target);

		proposal.withdraw(Instant.now());
		proposals.saveAndFlush(proposal);
		LOG.atInfo()
			.addKeyValue("event", "proposal.use_case.withdrawn")
			.addKeyValue("proposal_id", id)
			.addKeyValue("use_case_id", proposal.getUseCaseId())
			.addKeyValue("organization_id", proposal.getOrganizationId())
			.log("Proposal to a use case withdrawn");
		return form(actor, target, membership, proposal);
	}

	/** Queues the email that tells the sender their proposal is sent. It leaves once the sending commits. */
	private void tellSender(Actor actor, UseCaseProposal proposal, UseCaseTarget target, Membership membership) {
		Person sender = identity.person(actor);
		email.sendProposalSent(sender.email(), target.title(), membership.organizationName(), target.id(),
				editableUntil(proposal, target));
	}

	/**
	 * The proposals a use case received, for the members of the organization that posted it and for operators.
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
		Map<UUID, Person> deciders = identity.people(sent.stream()
			.map(UseCaseProposal::getDecidedByAccountId)
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		List<ReceivedUseCaseProposalSummaryResponse> items = sent.stream()
			.map(proposal -> summary(proposal, names, offeredBy, deciders))
			.toList();
		return new ReceivedUseCaseProposalsResponse(useCase(target), items,
				(int) sent.stream().filter(proposal -> UseCaseProposal.SHORTLISTED.equals(proposal.getDecision())).count(),
				(int) sent.stream().filter(proposal -> UseCaseProposal.DECLINED.equals(proposal.getDecision())).count(),
				(int) sent.stream().filter(UseCaseProposal::outcomePending).count());
	}

	/**
	 * The proposals a use case received as a spreadsheet, the latest first, for GenAI Fund to work with outside
	 * BeyondPilot. Only operators download, and the download is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the use case is unknown
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, UUID useCaseId, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		ReceivedUseCaseProposalsResponse received = received(actor, useCaseId);
		Spreadsheet<ReceivedUseCaseProposalSummaryResponse> sheet = Spreadsheet
			.<ReceivedUseCaseProposalSummaryResponse>of("Proposals")
			.text("Proposal", ReceivedUseCaseProposalSummaryResponse::id)
			.group("Sender")
			.text("Organization", ReceivedUseCaseProposalSummaryResponse::organizationName)
			.yesNo("Organization active", ReceivedUseCaseProposalSummaryResponse::organizationActive)
			.text("Contact", ReceivedUseCaseProposalSummaryResponse::contactName)
			.text("Solutions", proposal -> String.join(", ", proposal.solutionNames()))
			.time("Sent at", ReceivedUseCaseProposalSummaryResponse::sentAt)
			.time("Edited at", ReceivedUseCaseProposalSummaryResponse::editedAt)
			.group("Decision")
			.label("Decision", ReceivedUseCaseProposalSummaryResponse::decision)
			.time("Decided at", ReceivedUseCaseProposalSummaryResponse::decidedAt)
			.text("Decided by", ReceivedUseCaseProposalSummaryResponse::decidedBy)
			.yesNo("Outcome to send", ReceivedUseCaseProposalSummaryResponse::outcomePending)
			.time("Outcome sent at", ReceivedUseCaseProposalSummaryResponse::outcomeSentAt);
		SpreadsheetFile file = sheet.write(format, "use-case-proposals", received.items(),
				new Spreadsheet.About(operator.label(), Instant.now(), Map.of("Use case", received.useCase().title())));
		audit.record(new AuditRecord(AuditAction.USE_CASE_PROPOSAL_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("use_case", useCaseId.toString(), received.useCase().title()),
				Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "proposal.use_case.proposals_exported")
			.addKeyValue("use_case_id", useCaseId)
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Use case proposals exported");
		return file;
	}

	private ReceivedUseCaseProposalSummaryResponse summary(UseCaseProposal proposal, Map<UUID, OrganizationName> names,
			Map<UUID, List<UseCaseProposalSolution>> offeredBy, Map<UUID, Person> deciders) {
		OrganizationName organization = names.get(proposal.getOrganizationId());
		List<String> solutionNames = solutionsOf(offeredBy.getOrDefault(proposal.getId(), List.of())).stream()
			.map(ProposalSolutionResponse::name)
			.toList();
		SentByResponse sentBy = sentBy(proposal);
		UUID decider = proposal.getDecidedByAccountId();
		Person decidedBy = decider == null ? null : deciders.get(decider);
		return new ReceivedUseCaseProposalSummaryResponse(proposal.getId(), proposal.getOrganizationId(),
				organization == null ? "" : organization.name(),
				organization == null ? null : organization.logoFileId(), solutionNames,
				organizations.isActive(proposal.getOrganizationId()),
				sentBy == null ? null : label(sentBy.name(), sentBy.email()),
				Objects.requireNonNull(proposal.getSentAt()), proposal.getEditedAt(), proposal.getDecision(),
				proposal.getDecidedAt(), decidedBy == null ? null : decidedBy.label(), proposal.outcomePending(),
				proposal.getOutcomeSentAt());
	}

	/**
	 * Records what the organization that posted the use case decides on a proposal it received, which a member or an
	 * operator may change at any time, even after the outcomes were sent or the use case closed. It tells nobody, and
	 * the same decision again changes nothing.
	 * @throws ProposalException when the proposal was not sent, or the caller's organization did not post its use case
	 */
	@Transactional
	public ReceivedUseCaseProposalSummaryResponse decide(Actor actor, UUID id, String decision) {
		identity.requireActive(actor);
		UseCaseProposal proposal = proposals.findForUpdate(id).filter(UseCaseProposal::isSent).orElseThrow(() -> notFound(id));
		UseCaseTarget target = posted(actor, proposal.getUseCaseId());
		if (!decision.equals(proposal.getDecision())) {
			Instant now = Instant.now();
			proposal.decide(decision, actor.accountId(), now);
			proposals.saveAndFlush(proposal);
			decisions.save(new UseCaseProposalDecision(UUID.randomUUID(), id, decision, actor.accountId(), now));
			Person person = identity.person(actor);
			audit.record(new AuditRecord(AuditAction.USE_CASE_PROPOSAL_DECIDE,
					new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
					new AuditRecord.Resource("use_case_proposal", id.toString(), target.title()),
					Map.of("decision", decision)));
		}
		Map<UUID, OrganizationName> names = organizations.names(List.of(proposal.getOrganizationId()));
		return summary(proposal, names, offersOf(List.of(proposal)),
				identity.people(List.of(Objects.requireNonNull(proposal.getDecidedByAccountId()))));
	}

	/**
	 * E-mails the sender of each proposal whose decision is not the one they were last told, once for each, and notes
	 * that they were told. Undecided proposals and those already told the same decision are left out. Whoever may
	 * decide may send.
	 * @throws ProposalException when the caller's organization did not post the use case, or no proposal has an
	 * outcome to send
	 */
	@Transactional
	public UseCaseProposalOutcomesResponse sendOutcomes(Actor actor, UUID useCaseId, @Nullable String message) {
		identity.requireActive(actor);
		UseCaseTarget target = posted(actor, useCaseId);
		List<UseCaseProposal> pending = proposals.findSentForUpdate(useCaseId)
			.stream()
			.filter(UseCaseProposal::outcomePending)
			.toList();
		if (pending.isEmpty()) {
			throw new ProposalException(ProposalErrorCode.NOTHING_TO_SEND,
					"Use case " + useCaseId + " has no proposal with an outcome to send");
		}
		String note = text(message);
		Map<UUID, OrganizationName> names = organizations
			.names(pending.stream().map(UseCaseProposal::getOrganizationId).distinct().toList());
		Instant now = Instant.now();
		int shortlisted = 0;
		int declined = 0;
		for (UseCaseProposal proposal : pending) {
			UUID sender = proposal.getSentByAccountId();
			Person person = sender == null ? null : identity.people(List.of(sender)).get(sender);
			if (person == null) {
				continue;
			}
			boolean shortlist = UseCaseProposal.SHORTLISTED.equals(proposal.getDecision());
			OrganizationName organization = names.get(proposal.getOrganizationId());
			email.sendProposalOutcome(person.email(), shortlist, person.displayName(), target.title(),
					organization == null ? null : organization.name(), note, useCaseId);
			proposal.communicate(now);
			if (shortlist) {
				shortlisted++;
			}
			else {
				declined++;
			}
		}
		proposals.saveAllAndFlush(pending);
		Person person = identity.person(actor);
		audit.record(new AuditRecord(AuditAction.USE_CASE_PROPOSAL_OUTCOMES_SEND,
				new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource("use_case", useCaseId.toString(), target.title()),
				Map.of("sent", String.valueOf(shortlisted + declined), "shortlisted", String.valueOf(shortlisted),
						"declined", String.valueOf(declined))));
		LOG.atInfo()
			.addKeyValue("event", "proposal.use_case.outcomes_sent")
			.addKeyValue("use_case_id", useCaseId)
			.addKeyValue("sent", shortlisted + declined)
			.log("Outcomes of proposals to a use case sent");
		return new UseCaseProposalOutcomesResponse(shortlisted + declined, shortlisted, declined);
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
		UUID decider = proposal.getDecidedByAccountId();
		Person decidedBy = decider == null ? null : identity.people(List.of(decider)).get(decider);
		return new ReceivedUseCaseProposalResponse(proposal.getId(), useCase(target),
				organization == null ? "" : organization.name(), organization == null ? null : organization.logoFileId(),
				solutions(proposal),
				proposal.getApproach(), organizations.isActive(proposal.getOrganizationId()), sender,
				Objects.requireNonNull(sentBy(proposal)), proposal.getTeamBackground(), deck(proposal),
				Objects.requireNonNull(proposal.getSentAt()), proposal.getEditedAt(), proposal.getDecision(),
				proposal.getDecidedAt(), decidedBy == null ? null : decidedBy.label(), proposal.outcomePending(),
				proposal.getOutcomeSentAt());
	}

	/**
	 * {@link #received} for another module, for operators only.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the use case is unknown
	 */
	@Transactional(readOnly = true)
	public UseCaseProposalList proposalsOf(Actor actor, UUID useCaseId) {
		identity.requireOperator(actor);
		ReceivedUseCaseProposalsResponse received = received(actor, useCaseId);
		return new UseCaseProposalList(received.useCase().id(), received.useCase().title(),
				received.useCase().closesAt(), received.shortlisted(), received.declined(), received.pending(),
				received.items()
					.stream()
					.map(item -> new UseCaseProposalList.Item(item.id(), item.organizationName(), item.solutionNames(),
							item.contactName(), item.sentAt(), item.editedAt(), item.decision(), item.decidedAt(),
							item.decidedBy(), item.outcomeSentAt()))
					.toList());
	}

	/**
	 * {@link #receivedOne} for another module, for operators only.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProposalException when the proposal was not sent
	 */
	@Transactional(readOnly = true)
	public ReceivedProposal proposalOf(Actor actor, UUID id) {
		identity.requireOperator(actor);
		ReceivedUseCaseProposalResponse one = receivedOne(actor, id);
		SenderProfileResponse sender = one.sender();
		AttachedFileResponse deck = one.deck();
		return new ReceivedProposal(one.id(), one.useCase().id(), one.useCase().title(), one.organizationName(),
				one.organizationActive(), one.solutions()
					.stream()
					.map(solution -> new ReceivedProposal.Solution(solution.id(), solution.name(), solution.summary(),
							solution.slug()))
					.toList(),
				one.approach(), one.teamBackground(),
				new ReceivedProposal.Contact(one.sentBy().name(), one.sentBy().email(), one.sentBy().country(),
						one.sentBy().phone()),
				sender == null ? null
						: new ReceivedProposal.Sender(sender.name(), sender.headline(), sender.bio(), sender.roles(),
								sender.skills(), sender.country(), sender.worksAt(), sender.website()),
				deck == null ? null : new ReceivedProposal.Deck(deck.fileId(), deck.fileName(), deck.sizeBytes()),
				one.sentAt(), one.editedAt(), one.decision(), one.decidedAt(), one.decidedBy(), one.outcomeSentAt());
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

	/**
	 * The PDF of the proposal the caller's organization wrote to a use case, a draft or a sent one.
	 * @throws ProposalException when the organization has no proposal to the use case, or it holds no PDF
	 */
	@Transactional(readOnly = true)
	public FileDownload ownFile(Actor actor, UUID useCaseId) {
		identity.requireActive(actor);
		Membership membership = organizations.membershipOf(actor).orElseThrow(() -> notFound(useCaseId));
		UUID deck = proposals.findByUseCaseIdAndOrganizationId(useCaseId, membership.organizationId())
			.map(UseCaseProposal::getDeckFileId)
			.orElseThrow(() -> notFound(useCaseId));
		return storage.download(deck);
	}

	/**
	 * The proposals a use case holds now, sent and not withdrawn, the latest first, with what each says and the PDF it
	 * attached, for matching to judge them (BEY-229). Nobody is checked here: it is read by a module, never answered to
	 * a person as it is.
	 */
	@Transactional(readOnly = true)
	public List<SentUseCaseProposal> sentTo(UUID useCaseId) {
		List<UseCaseProposal> sent = proposals.findByUseCaseIdAndStatusOrderBySentAtDesc(useCaseId,
				UseCaseProposal.SENT);
		Map<UUID, List<UseCaseProposalSolution>> offeredBy = offersOf(sent);
		Map<UUID, StoredFile> files = storage.describe(sent.stream()
			.map(UseCaseProposal::getDeckFileId)
			.filter(Objects::nonNull)
			.toList());
		return sent.stream().map(proposal -> {
			StoredFile file = proposal.getDeckFileId() == null ? null : files.get(proposal.getDeckFileId());
			List<SentUseCaseProposal.Solution> offered = offeredBy.getOrDefault(proposal.getId(), List.of())
				.stream()
				.map(offer -> solutions.offered(offer.getSolutionId()))
				.flatMap(Optional::stream)
				.map(solution -> new SentUseCaseProposal.Solution(solution.id(), solution.name(), solution.summary()))
				.toList();
			Instant edited = proposal.getEditedAt();
			return new SentUseCaseProposal(proposal.getId(), proposal.getUseCaseId(), proposal.getOrganizationId(),
					edited != null ? edited : Objects.requireNonNull(proposal.getSentAt()), proposal.getApproach(),
					proposal.getTeamBackground(),
					file == null ? null
							// Opened only when it is read, so that a file gone from storage leaves the rest readable.
							: new SentUseCaseProposal.Deck(file.id(), file.fileName(), file.mediaType(),
									() -> storage.content(file.id()).getInputStream()),
					offered, proposal.getDecision());
		}).toList();
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
		requireOpenToNew(target);
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

	/**
	 * A new proposal is made and sent only while the use case is open and outside a challenge that takes applications:
	 * there, answers go to the challenge's application, so that they are all reviewed in one place. What was sent before
	 * stays, and can be edited or withdrawn under the use case's own dates.
	 */
	private static void requireOpenToNew(UseCaseTarget target) {
		requireOpen(target);
		if (target.challenge() != null) {
			throw inChallenge(target);
		}
	}

	private static ProposalException inChallenge(UseCaseTarget target) {
		return new ProposalException(ProposalErrorCode.USE_CASE_IN_CHALLENGE,
				"Use case " + target.id() + " is answered through challenge " + target.challenge());
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
			boolean team, @Nullable String teamBackground) {
		if (!hasSolution) {
			throw refused(ProposalErrorCode.SOLUTION_REQUIRED, id);
		}
		if (blank(approach)) {
			throw refused(ProposalErrorCode.APPROACH_REQUIRED, id);
		}
		if (deck == null) {
			throw refused(ProposalErrorCode.PDF_REQUIRED, id);
		}
		// A team says what it has done, as an application to a program asks of one.
		if (team && blank(teamBackground)) {
			throw refused(ProposalErrorCode.TEAM_BACKGROUND_REQUIRED, id);
		}
	}

	/** Whether the proposal comes from a team, which writes what it has done. */
	private static boolean isTeam(Membership membership) {
		return "builder_team".equals(membership.type());
	}

	/**
	 * The caller's membership, of any organization other than the one that posted the use case. GenAI Fund's review of
	 * the organization decides whether it is listed, not whether it sends a proposal.
	 */
	private Membership member(Actor actor, UseCaseTarget target) {
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.NO_ORGANIZATION,
					"Account " + actor.accountId() + " belongs to no organization"));
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
		if (identity.isOperator(actor)) {
			return target;
		}
		organizations.membershipOf(actor)
			.filter(membership -> membership.organizationId().equals(target.organizationId()))
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.USE_CASE_NOT_FOUND,
					"Account " + actor.accountId() + " is not of the organization that posted use case " + useCaseId));
		return target;
	}

	/** A sent proposal of a use case the caller's organization posted, or any when the caller is an operator. */
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
			return new UseCaseProposalFormResponse(useCase(target), null, null);
		}
		UUID organizationId = membership.organizationId();
		OrganizationName name = organizations.names(List.of(organizationId)).get(organizationId);
		return new UseCaseProposalFormResponse(useCase(target),
				new ProposingOrganizationResponse(organizationId, membership.organizationName(),
						name == null ? null : name.logoFileId(), membership.active(), membership.type(),
						membership.owner(), organizations.profile(organizationId).map(profile -> profile.teamBackground()).orElse(null)),
				proposal == null ? null : response(proposal, target));
	}

	private UseCaseProposalResponse response(UseCaseProposal proposal, UseCaseTarget target) {
		return new UseCaseProposalResponse(proposal.getId(), proposal.getStatus(), solutions(proposal),
				proposal.getApproach(), deck(proposal), proposal.getTeamBackground(), senderOf(proposal), sentBy(proposal),
				proposal.getSentAt(),
				editableUntil(proposal, target), proposal.getEditedAt(), proposal.getWithdrawnAt(), proposal.getOutcome(), proposal.getOutcomeSentAt(), proposal.getVersion(),
				proposal.getUpdatedAt());
	}

	private @Nullable SentByResponse sentBy(UseCaseProposal proposal) {
		UUID sentBy = proposal.getSentByAccountId();
		Person person = sentBy == null ? null : identity.people(List.of(sentBy)).get(sentBy);
		return person == null ? null
				: new SentByResponse(person.displayName(), person.email(), person.country(), person.phone());
	}

	private @Nullable SenderProfileResponse senderOf(UseCaseProposal proposal) {
		if (proposal.getTalent() == null) {
			return null;
		}
		SenderProfileResponse kept = json.readValue(proposal.getTalent(), SenderProfileResponse.class);
		UUID sentBy = proposal.getSentByAccountId();
		Person person = sentBy == null ? null : identity.people(List.of(sentBy)).get(sentBy);
		return person == null ? kept : kept.withEmail(person.email());
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
