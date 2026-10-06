package ai.genaifund.beyondpilot.talent;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageException;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.talent.dto.MyTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.SaveTalentProfileRequest;
import ai.genaifund.beyondpilot.talent.dto.SendTalentEnquiryRequest;
import ai.genaifund.beyondpilot.talent.dto.TalentEnquiryResponse;
import ai.genaifund.beyondpilot.talent.dto.TalentProfileResponse;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a person does with their own talent profile, and what someone signed in does with another's: send a message
 * through it, which the person accepts, declines or reports. A person has one profile and only they write it.
 */
@Service
public class TalentService {

	private static final Logger LOG = LoggerFactory.getLogger(TalentService.class);

	/** How long a message waits for the person's answer before it closes. */
	static final Duration ENQUIRY_LIFETIME = Duration.ofDays(14);

	/** How many conversations a sender starts in a day, to any profiles. */
	static final int ENQUIRIES_A_DAY = 10;

	private static final Duration DAY = Duration.ofDays(1);

	private static final int ENQUIRIES_SHOWN = 100;

	private static final String ENQUIRY = "talent_enquiry";

	private static final String TALENT = "talent";

	private final TalentProfileRepository profiles;

	private final TalentDetailRepository details;

	private final IdentityService identity;

	private final EmailService email;

	private final OrganizationDirectory organizations;

	private final AuditTrail audit;

	private final StorageService storage;

	private final ApplicationEventPublisher events;

	TalentService(TalentProfileRepository profiles, TalentDetailRepository details, IdentityService identity,
			EmailService email, OrganizationDirectory organizations, AuditTrail audit, StorageService storage,
			ApplicationEventPublisher events) {
		this.profiles = profiles;
		this.details = details;
		this.identity = identity;
		this.email = email;
		this.organizations = organizations;
		this.audit = audit;
		this.storage = storage;
		this.events = events;
	}

	/**
	 * The caller's profile, when they have one, with the messages sent through it. A sender's address is shown only on
	 * a message the caller accepted; a message from an account that no longer signs in is left out.
	 */
	@Transactional(readOnly = true)
	public MyTalentResponse mine(Actor actor) {
		identity.requireActive(actor);
		TalentProfile profile = profiles.findByAccountId(actor.accountId()).orElse(null);
		if (profile == null) {
			return new MyTalentResponse(null, List.of());
		}
		List<TalentDetailRepository.Enquiry> enquiries = details.enquiries(profile.getId(), ENQUIRIES_SHOWN);
		Map<UUID, Person> senders = identity
			.people(enquiries.stream().map(TalentDetailRepository.Enquiry::senderAccountId).distinct().toList());
		Map<UUID, OrganizationName> senderOrganizations = organizations.names(enquiries.stream()
			.map(TalentDetailRepository.Enquiry::senderOrganizationId)
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		return new MyTalentResponse(TalentViews.profile(profile, details.projects(profile.getId())),
				enquiries.stream().filter(enquiry -> senders.containsKey(enquiry.senderAccountId())).map(enquiry -> {
					Person sender = senders.get(enquiry.senderAccountId());
					UUID organizationId = enquiry.senderOrganizationId();
					OrganizationName organization = organizationId == null ? null
							: senderOrganizations.get(organizationId);
					boolean waiting = TalentDetailRepository.PENDING.equals(enquiry.status());
					boolean accepted = TalentDetailRepository.ACCEPTED.equals(enquiry.status());
					// Before an acceptance the sender is named only by the name they gave, never by their address.
					String name = enquiry.senderName() != null ? enquiry.senderName()
							: accepted ? sender.label() : sender.displayName();
					return new TalentEnquiryResponse(enquiry.id(), name,
							organization == null ? null : organization.name(),
							accepted ? sender.email() : null,
							enquiry.topic(), enquiry.message(), enquiry.status(), enquiry.createdAt(),
							enquiry.answeredAt(), waiting ? enquiry.createdAt().plus(ENQUIRY_LIFETIME) : null);
				}).toList());
	}

	/**
	 * Saves the caller's profile as its edit screen holds it; the first save creates it as a draft. A change to an
	 * approved profile shows at once; one to a profile GenAI Fund sent back waits for the person to submit it again.
	 * @throws TalentException when the profile changed since the screen read it, or a submitted or approved profile
	 * would lose what a submission needs
	 */
	@Transactional
	public TalentProfileResponse save(Actor actor, SaveTalentProfileRequest request) {
		identity.requireActive(actor);
		String name = request.name().strip();
		TalentProfile profile = profiles.findByAccountForUpdate(actor.accountId()).orElse(null);
		if (profile == null) {
			profile = profiles.save(new TalentProfile(UUID.randomUUID(), actor.accountId(), freeSlug(name), name));
		}
		else if (request.version() == null || profile.getVersion() != request.version()) {
			throw new TalentException(TalentErrorCode.CHANGED_MEANWHILE, "Save of talent profile " + profile.getId()
					+ " at version " + request.version() + ", which is at " + profile.getVersion());
		}
		profile.describe(name, TalentViews.text(request.headline()), TalentViews.text(request.bio()),
				TalentViews.distinct(request.roles()), TalentViews.distinct(request.skills()), request.country(),
				TalentViews.distinct(request.engagement()), request.rateBand(),
				TalentViews.text(request.website()));
		profile.state(TalentViews.text(request.city()), TalentViews.distinct(request.languages()),
				TalentViews.distinct(request.industries()), TalentViews.text(request.worksAt()));
		UUID formerPhoto = profile.getPhotoFileId();
		UUID photo = request.photoFileId();
		if (photo != null && !photo.equals(formerPhoto)) {
			requireUsablePhoto(actor, photo);
		}
		profile.picture(photo);
		profile.list(request.listed());
		if (!profile.isDraft() && !profile.isReturned() && !profile.isComplete()) {
			// What operators review, and what the directory shows, keeps what a submission needs.
			throw incomplete(profile);
		}
		List<TalentDetailRepository.Project> projects = request.projects()
			.stream()
			.map(project -> new TalentDetailRepository.Project(project.title().strip(),
					TalentViews.text(project.summary()), TalentViews.text(project.url()), project.year(),
					project.stage()))
			.toList();
		profiles.flush();
		details.replaceProjects(profile.getId(), projects);
		events.publishEvent(new TalentProfileChanged(profile.getId()));
		if (formerPhoto != null && !formerPhoto.equals(photo)) {
			// The profile no longer names it, so nobody reads it again.
			storage.delete(formerPhoto);
		}
		return TalentViews.profile(profile, projects);
	}

	/**
	 * Sends the caller's draft, or their profile once corrected after GenAI Fund asked for changes or removed it, to
	 * GenAI Fund for review.
	 * @throws TalentException when the caller has no profile, it lacks what a submission needs, or it is already
	 * submitted or approved
	 */
	@Transactional
	public TalentProfileResponse submit(Actor actor) {
		identity.requireActive(actor);
		TalentProfile profile = profiles.findByAccountForUpdate(actor.accountId())
			.orElseThrow(() -> new TalentException(TalentErrorCode.PROFILE_NOT_FOUND,
					"No talent profile for account " + actor.accountId()));
		if (!profile.isDraft() && !profile.isReturned()) {
			throw new TalentException(TalentErrorCode.NOT_SUBMITTABLE,
					"Submission of talent profile " + profile.getId() + ", which is " + profile.getStatus());
		}
		if (!profile.isComplete()) {
			throw incomplete(profile);
		}
		profile.submit(Instant.now());
		// The response carries the version the next save must send.
		profiles.flush();
		LOG.atInfo()
			.addKeyValue("event", "talent.submission.accepted")
			.addKeyValue("profile_id", profile.getId())
			.log("Talent profile submitted for review");
		return TalentViews.profile(profile, details.projects(profile.getId()));
	}

	/**
	 * Sends a message to the person behind a listed profile, signed with the name the sender gives. They are told by
	 * email who wrote, about what and from which organization, without the sender's address; the two addresses are
	 * shared only if they accept.
	 * @throws TalentException when no approved, listed profile has the address, it is the caller's own, the caller's
	 * earlier message to it still waits, or the caller started ten conversations within the last day
	 */
	@Transactional
	public void enquire(Actor actor, String slug, SendTalentEnquiryRequest request) {
		Person sender = identity.person(actor);
		TalentProfile profile = profiles.findBySlug(slug)
			.filter(found -> found.isApproved() && found.isListed())
			.orElseThrow(() -> new TalentException(TalentErrorCode.PROFILE_NOT_FOUND, "No listed talent at " + slug));
		if (profile.getAccountId().equals(actor.accountId())) {
			throw new TalentException(TalentErrorCode.OWN_PROFILE, "Enquiry to the sender's own profile");
		}
		if (details.waitingSince(profile.getId(), actor.accountId()).isPresent()) {
			throw pending(profile);
		}
		if (details.sentSince(actor.accountId(), Instant.now().minus(DAY)) >= ENQUIRIES_A_DAY) {
			throw new TalentException(TalentErrorCode.ENQUIRY_LIMIT,
					"Enquiry beyond " + ENQUIRIES_A_DAY + " in a day by account " + actor.accountId());
		}
		Person recipient = identity.people(List.of(profile.getAccountId())).get(profile.getAccountId());
		if (recipient == null) {
			// The account behind the profile no longer signs in, so nobody would read the message.
			throw new TalentException(TalentErrorCode.PROFILE_NOT_FOUND, "No active account behind talent at " + slug);
		}
		// The person reads the sender's organization only once GenAI Fund approved it.
		Membership membership = organizations.membershipOf(actor).filter(Membership::approved).orElse(null);
		String message = request.message().strip();
		String senderName = request.senderName().strip();
		if (!details.addEnquiry(profile.getId(), actor.accountId(), senderName,
				membership == null ? null : membership.organizationId(), request.topic(), message)) {
			throw pending(profile);
		}
		email.sendTalentEnquiry(recipient.email(), senderName,
				membership == null ? null : membership.organizationName(), request.topic(), message);
		LOG.atInfo()
			.addKeyValue("event", "talent.enquiry.sent")
			.addKeyValue("profile_id", profile.getId())
			.log("Talent enquiry sent");
	}

	/**
	 * Accepts a message to the caller's profile: the sender and the caller are each told the other's name and address.
	 * @throws TalentException when the message is not to the caller's profile, was answered already or closed, or its
	 * sender no longer signs in
	 */
	@Transactional
	public void accept(Actor actor, UUID id) {
		TalentProfile profile = own(actor);
		TalentDetailRepository.Enquiry enquiry = waiting(profile, id);
		Person sender = identity.people(List.of(enquiry.senderAccountId())).get(enquiry.senderAccountId());
		if (sender == null) {
			// The account that wrote no longer signs in, so nobody would read the introduction.
			throw enquiryNotFound(id);
		}
		Person person = identity.person(actor);
		UUID organizationId = enquiry.senderOrganizationId();
		OrganizationName senderOrganization = organizationId == null ? null
				: organizations.names(List.of(organizationId)).get(organizationId);
		details.answer(id, TalentDetailRepository.ACCEPTED);
		email.sendTalentIntroduction(sender.email(), profile.getName(), person.email(), null);
		email.sendTalentIntroduction(person.email(),
				enquiry.senderName() != null ? enquiry.senderName() : sender.label(), sender.email(),
				senderOrganization == null ? null : senderOrganization.name());
		record(AuditAction.TALENT_ENQUIRY_ACCEPT, person, actor, enquiry, profile);
	}

	/**
	 * Declines a message to the caller's profile. The sender is told the person will not take it further.
	 * @throws TalentException when the message is not to the caller's profile, or was answered already or closed
	 */
	@Transactional
	public void decline(Actor actor, UUID id) {
		refuse(actor, id, TalentDetailRepository.DECLINED, AuditAction.TALENT_ENQUIRY_DECLINE);
	}

	/**
	 * Reports a message to the caller's profile as unwanted, for GenAI Fund to read. The sender is told the same as on
	 * a decline, so the person who reported is not exposed.
	 * @throws TalentException when the message is not to the caller's profile, or was answered already or closed
	 */
	@Transactional
	public void report(Actor actor, UUID id) {
		refuse(actor, id, TalentDetailRepository.REPORTED, AuditAction.TALENT_ENQUIRY_REPORT);
	}

	private void refuse(Actor actor, UUID id, String status, AuditAction action) {
		TalentProfile profile = own(actor);
		TalentDetailRepository.Enquiry enquiry = waiting(profile, id);
		details.answer(id, status);
		Person sender = identity.people(List.of(enquiry.senderAccountId())).get(enquiry.senderAccountId());
		if (sender != null) {
			email.sendTalentEnquiryDeclined(sender.email(), profile.getName());
		}
		record(action, identity.person(actor), actor, enquiry, profile);
	}

	private TalentProfile own(Actor actor) {
		identity.requireActive(actor);
		return profiles.findByAccountId(actor.accountId())
			.orElseThrow(() -> new TalentException(TalentErrorCode.PROFILE_NOT_FOUND,
					"No talent profile for account " + actor.accountId()));
	}

	/** The message to this profile that still waits; one to another profile answers the same as none. */
	private TalentDetailRepository.Enquiry waiting(TalentProfile profile, UUID id) {
		TalentDetailRepository.Enquiry enquiry = details.findEnquiryForUpdate(id)
			.filter(found -> found.profileId().equals(profile.getId()))
			.orElseThrow(() -> enquiryNotFound(id));
		if (!TalentDetailRepository.PENDING.equals(enquiry.status())) {
			throw new TalentException(TalentErrorCode.ENQUIRY_NOT_PENDING,
					"Talent enquiry " + id + " is " + enquiry.status());
		}
		return enquiry;
	}

	private void record(AuditAction action, Person person, Actor actor, TalentDetailRepository.Enquiry enquiry,
			TalentProfile profile) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(actor.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(ENQUIRY, enquiry.id().toString(), profile.getName()), Map.of()));
	}

	private static TalentException pending(TalentProfile profile) {
		return new TalentException(TalentErrorCode.ENQUIRY_PENDING,
				"A second waiting enquiry to talent profile " + profile.getId());
	}

	private static TalentException enquiryNotFound(UUID id) {
		return new TalentException(TalentErrorCode.ENQUIRY_NOT_FOUND, "No talent enquiry " + id);
	}

	/**
	 * Deletes the caller's profile with its projects and the messages sent through it. The audit trail keeps that it
	 * was deleted, and by whom.
	 * @throws TalentException when the caller has no profile
	 */
	@Transactional
	public void delete(Actor actor) {
		Person person = identity.person(actor);
		TalentProfile profile = profiles.findByAccountForUpdate(actor.accountId())
			.orElseThrow(() -> new TalentException(TalentErrorCode.PROFILE_NOT_FOUND,
					"No talent profile for account " + actor.accountId()));
		audit.record(new AuditRecord(AuditAction.TALENT_DELETE,
				new AuditRecord.Actor(actor.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(TALENT, profile.getId().toString(), profile.getName()), Map.of()));
		UUID photo = profile.getPhotoFileId();
		profiles.delete(profile);
		events.publishEvent(new TalentProfileChanged(profile.getId()));
		if (photo != null) {
			profiles.flush();
			storage.delete(photo);
		}
		LOG.atInfo()
			.addKeyValue("event", "talent.profile.deleted")
			.addKeyValue("profile_id", profile.getId())
			.log("Talent profile deleted by its person");
	}

	/** A photo is a stored image the caller uploaded for a profile, and the photo of no other profile. */
	private void requireUsablePhoto(Actor actor, UUID photo) {
		try {
			storage.stored(photo, FilePurpose.TALENT_PHOTO, actor);
		}
		catch (StorageException notUsable) {
			throw new TalentException(TalentErrorCode.PHOTO_NOT_USABLE, "File " + photo + " as a talent photo",
					notUsable);
		}
		if (profiles.existsByPhotoFileId(photo)) {
			throw new TalentException(TalentErrorCode.PHOTO_NOT_USABLE, "File " + photo + " is another profile's photo");
		}
	}

	private String freeSlug(String name) {
		String base = TalentViews.slug(name);
		String slug = base;
		for (int suffix = 2; profiles.existsBySlug(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		return slug;
	}

	private static TalentException incomplete(TalentProfile profile) {
		return new TalentException(TalentErrorCode.INCOMPLETE,
				"Talent profile " + profile.getId() + " lacks what a submission needs");
	}
}
