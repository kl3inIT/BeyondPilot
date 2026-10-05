package ai.genaifund.beyondpilot.talent;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a person does with their own talent profile, and what someone signed in does with another's: send a message
 * through it. A person has one profile and only they write it.
 */
@Service
public class TalentService {

	private static final Logger LOG = LoggerFactory.getLogger(TalentService.class);

	/** How long a sender waits before writing through the same profile again. */
	private static final Duration ENQUIRY_INTERVAL = Duration.ofDays(1);

	private static final int ENQUIRIES_SHOWN = 50;

	private final TalentProfileRepository profiles;

	private final TalentDetailRepository details;

	private final IdentityService identity;

	private final EmailService email;

	TalentService(TalentProfileRepository profiles, TalentDetailRepository details, IdentityService identity,
			EmailService email) {
		this.profiles = profiles;
		this.details = details;
		this.identity = identity;
		this.email = email;
	}

	/** The caller's profile, when they have one, with the messages sent through it. */
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
		return new MyTalentResponse(TalentViews.profile(profile, details.projects(profile.getId())),
				enquiries.stream().filter(enquiry -> senders.containsKey(enquiry.senderAccountId())).map(enquiry -> {
					Person sender = senders.get(enquiry.senderAccountId());
					return new TalentEnquiryResponse(enquiry.id(), sender.label(), sender.email(), enquiry.message(),
							enquiry.createdAt());
				}).toList());
	}

	/**
	 * Saves the caller's profile as its edit screen holds it; the first save creates it as a draft. A change to an
	 * approved profile shows at once; one to a rejected profile waits for the person to submit it again.
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
				request.availability(), TalentViews.distinct(request.engagement()), request.rateBand(),
				TalentViews.text(request.website()));
		profile.list(request.listed());
		if (!profile.isDraft() && !profile.isRejected() && !profile.isComplete()) {
			// What operators review, and what the directory shows, keeps what a submission needs.
			throw incomplete(profile);
		}
		List<TalentDetailRepository.Project> projects = request.projects()
			.stream()
			.map(project -> new TalentDetailRepository.Project(project.title().strip(),
					TalentViews.text(project.summary()), TalentViews.text(project.url()), project.year()))
			.toList();
		profiles.flush();
		details.replaceProjects(profile.getId(), projects);
		return TalentViews.profile(profile, projects);
	}

	/**
	 * Sends the caller's draft, or their rejected profile once corrected, to GenAI Fund for review.
	 * @throws TalentException when the caller has no profile, it lacks what a submission needs, or it is already
	 * submitted or approved
	 */
	@Transactional
	public TalentProfileResponse submit(Actor actor) {
		identity.requireActive(actor);
		TalentProfile profile = profiles.findByAccountForUpdate(actor.accountId())
			.orElseThrow(() -> new TalentException(TalentErrorCode.PROFILE_NOT_FOUND,
					"No talent profile for account " + actor.accountId()));
		if (!profile.isDraft() && !profile.isRejected()) {
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
	 * Sends a message to the person behind a listed profile. They get it by email with the sender's address, and the
	 * sender never learns theirs.
	 * @throws TalentException when no approved, listed profile has the address, it is the caller's own, or the caller
	 * wrote through it within the last day
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
		if (details.enquiredSince(profile.getId(), actor.accountId(), Instant.now().minus(ENQUIRY_INTERVAL))) {
			throw new TalentException(TalentErrorCode.ENQUIRY_TOO_SOON,
					"Second enquiry to talent profile " + profile.getId() + " within a day");
		}
		Person recipient = identity.people(List.of(profile.getAccountId())).get(profile.getAccountId());
		if (recipient == null) {
			// The account behind the profile no longer signs in, so nobody would read the message.
			throw new TalentException(TalentErrorCode.PROFILE_NOT_FOUND, "No active account behind talent at " + slug);
		}
		String message = request.message().strip();
		details.addEnquiry(profile.getId(), actor.accountId(), message);
		email.sendTalentEnquiry(recipient.email(), sender.label(), sender.email(), message);
		LOG.atInfo()
			.addKeyValue("event", "talent.enquiry.sent")
			.addKeyValue("profile_id", profile.getId())
			.log("Talent enquiry sent");
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
