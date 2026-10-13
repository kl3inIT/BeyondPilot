package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageException;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.talent.dto.MyTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.SaveTalentProfileRequest;
import ai.genaifund.beyondpilot.talent.dto.TalentProfileResponse;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** What a person does with their own talent profile. A person has one profile and only they write it. */
@Service
public class TalentService {

	private static final Logger LOG = LoggerFactory.getLogger(TalentService.class);

	private static final String TALENT = "talent";

	private final TalentProfileRepository profiles;

	private final TalentDetailRepository details;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final StorageService storage;

	private final ApplicationEventPublisher events;

	TalentService(TalentProfileRepository profiles, TalentDetailRepository details, IdentityService identity,
			AuditTrail audit, StorageService storage, ApplicationEventPublisher events) {
		this.profiles = profiles;
		this.details = details;
		this.identity = identity;
		this.audit = audit;
		this.storage = storage;
		this.events = events;
	}

	/** The caller's profile, when they have one. */
	@Transactional(readOnly = true)
	public MyTalentResponse mine(Actor actor) {
		identity.requireActive(actor);
		return new MyTalentResponse(profiles.findByAccountId(actor.accountId())
			.map(profile -> TalentViews.profile(profile, details.projects(profile.getId())))
			.orElse(null));
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
			.orElseThrow(() -> noProfile(actor));
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

	private static TalentException noProfile(Actor actor) {
		return new TalentException(TalentErrorCode.PROFILE_NOT_FOUND, "No talent profile for account " + actor.accountId());
	}

	/**
	 * Deletes the caller's profile with its projects, and with them the conversations started through it. The audit
	 * trail keeps that it was deleted, and by whom.
	 * @throws TalentException when the caller has no profile
	 */
	@Transactional
	public void delete(Actor actor) {
		Person person = identity.person(actor);
		TalentProfile profile = profiles.findByAccountForUpdate(actor.accountId())
			.orElseThrow(() -> noProfile(actor));
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
