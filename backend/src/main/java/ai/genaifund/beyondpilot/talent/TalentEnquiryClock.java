package ai.genaifund.beyondpilot.talent;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.BusinessException;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * What time does to a message nobody answers: the person is reminded once after seven days, and the message closes
 * after fourteen, which the sender is told. Each message is handled in its own transaction, so one email that fails does
 * not hold back the others; it is tried again on the next run.
 *
 * <p>
 * The application runs as one instance. The rows a run handles are locked and skipped by another run, but a second
 * instance could still remind a person twice if both read a message before either marked it.
 */
@Component
@EnableScheduling
class TalentEnquiryClock {

	private static final Logger LOG = LoggerFactory.getLogger(TalentEnquiryClock.class);

	/** When the person is reminded of a message that waits. */
	static final Duration REMINDER_AFTER = Duration.ofDays(7);

	/** How many messages one run handles of each kind; the rest wait for the next run. */
	private static final int BATCH = 100;

	private final TalentDetailRepository details;

	private final TalentProfileRepository profiles;

	private final IdentityService identity;

	private final EmailService email;

	private final TransactionTemplate transaction;

	TalentEnquiryClock(TalentDetailRepository details, TalentProfileRepository profiles, IdentityService identity,
			EmailService email, PlatformTransactionManager transactions) {
		this.details = details;
		this.profiles = profiles;
		this.identity = identity;
		this.email = email;
		this.transaction = new TransactionTemplate(transactions);
	}

	@Scheduled(initialDelayString = "PT1M", fixedDelayString = "PT1H")
	void run() {
		Instant now = Instant.now();
		close(now);
		remind(now);
	}

	/** Closes the messages that waited longer than their lifetime and tells each sender. */
	int close(Instant now) {
		int closed = 0;
		for (TalentDetailRepository.Enquiry enquiry : due(now.minus(TalentService.ENQUIRY_LIFETIME), false)) {
			if (handle(enquiry, () -> {
				details.answer(enquiry.id(), TalentDetailRepository.CLOSED);
				Person sender = person(enquiry.senderAccountId());
				TalentProfile profile = profiles.findById(enquiry.profileId()).orElse(null);
				if (sender != null && profile != null) {
					email.sendTalentEnquiryClosed(sender.email(), profile.getName());
				}
			})) {
				closed++;
			}
		}
		return closed;
	}

	/** Reminds each person once of a message that waited longer than the reminder delay. */
	int remind(Instant now) {
		int reminded = 0;
		for (TalentDetailRepository.Enquiry enquiry : due(now.minus(REMINDER_AFTER), true)) {
			if (handle(enquiry, () -> {
				details.markReminded(enquiry.id());
				Person sender = person(enquiry.senderAccountId());
				TalentProfile profile = profiles.findById(enquiry.profileId()).orElse(null);
				Person recipient = profile == null ? null : person(profile.getAccountId());
				if (sender != null && recipient != null) {
					long daysLeft = Math.max(1, Duration
						.between(now, enquiry.createdAt().plus(TalentService.ENQUIRY_LIFETIME))
						.toDays());
					email.sendTalentEnquiryReminder(recipient.email(),
							TalentViews.senderName(enquiry.senderName(), sender), daysLeft);
				}
			})) {
				reminded++;
			}
		}
		return reminded;
	}

	/** The waiting messages that are due, read in a short transaction; each is locked again and checked to handle. */
	private List<TalentDetailRepository.Enquiry> due(Instant before, boolean unreminded) {
		List<TalentDetailRepository.Enquiry> found = transaction.execute(status -> unreminded
				? details.unremindedBefore(before, BATCH) : details.waitingBefore(before, BATCH));
		return found == null ? List.of() : found;
	}

	/** Runs one message's change in its own transaction, after checking it still waits; false when it did not run. */
	private boolean handle(TalentDetailRepository.Enquiry enquiry, Runnable change) {
		try {
			Boolean done = transaction.execute(status -> {
				boolean waiting = details.findEnquiryForUpdate(enquiry.id())
					.filter(now -> TalentDetailRepository.PENDING.equals(now.status()))
					.isPresent();
				if (waiting) {
					change.run();
				}
				return waiting;
			});
			return Boolean.TRUE.equals(done);
		}
		catch (RuntimeException exception) {
			LOG.atWarn()
				.addKeyValue("event", "talent.enquiry.clock_failed")
				.addKeyValue("enquiry_id", enquiry.id())
				.addKeyValue("error_type", exception.getClass().getName())
				.addKeyValue("error_code", exception instanceof BusinessException business ? business.code() : null)
				.log("A waiting talent enquiry was not handled; the next run tries again");
			return false;
		}
	}

	private @Nullable Person person(UUID accountId) {
		return identity.people(List.of(accountId)).get(accountId);
	}
}
