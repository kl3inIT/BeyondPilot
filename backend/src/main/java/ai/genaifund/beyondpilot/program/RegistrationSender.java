package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import jakarta.annotation.PreDestroy;

import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaForm;
import ai.genaifund.beyondpilot.program.luma.LumaGuest;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import ai.genaifund.beyondpilot.program.persistence.LumaRegistration;
import ai.genaifund.beyondpilot.program.persistence.LumaRegistrationRepository;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramEvent;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sends each registration kept on BeyondPilot to its Luma event, with Luma's own email off, then emails the person what
 * became of it (BEY-245). Luma adds a guest in the background and returns no identifier, so the guest is then read by
 * address. An attempt that fails is tried again later, waiting longer each time; one Luma refuses, or that fails too
 * often, stops for an operator. A person is never told they are on Luma before they are.
 */
@Component
class RegistrationSender {

	private static final Logger LOG = LoggerFactory.getLogger(RegistrationSender.class);

	private static final JsonMapper JSON = JsonMapper.builder().build();

	/** The waits after each failed attempt; the attempt after the last stops the sending. */
	private static final List<Duration> WAITS = List.of(Duration.ofMinutes(1), Duration.ofMinutes(5),
			Duration.ofMinutes(15), Duration.ofHours(1), Duration.ofHours(3), Duration.ofHours(6));

	/** How often, and how long apart, the guest Luma adds in the background is looked for. */
	private static final int LOOKS = 3;

	private static final Duration BETWEEN_LOOKS = Duration.ofSeconds(2);

	private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("EEE d MMM yyyy, HH:mm 'GMT'xxx",
			Locale.ENGLISH);

	private final LumaRegistrationRepository registrations;

	private final ProgramRepository programs;

	private final LumaConnectionRepository connections;

	private final LumaKeys keys;

	private final EmailService email;

	private final LumaApi api;

	private final TransactionTemplate transactions;

	/** Sends a new registration at once, away from the request that kept it. */
	private final ExecutorService soon = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("luma-send").factory());

	RegistrationSender(LumaRegistrationRepository registrations, ProgramRepository programs,
			LumaConnectionRepository connections, LumaKeys keys, EmailService email, LumaProperties properties,
			TransactionTemplate transactions) {
		this.registrations = registrations;
		this.programs = programs;
		this.connections = connections;
		this.keys = keys;
		this.email = email;
		this.api = new LumaApi(properties.api(), properties.timeout());
		this.transactions = transactions;
	}

	/** Sends the registration soon, once it is kept. */
	void sendSoon(UUID id) {
		soon.execute(() -> send(id, Instant.now()));
	}

	@PreDestroy
	void stop() {
		soon.shutdownNow();
	}

	@Scheduled(fixedDelayString = "${beyondpilot.program.luma.send-interval:1m}", initialDelay = 60_000)
	void sendDue() {
		Instant now = Instant.now();
		for (UUID id : registrations.findDue(now)) {
			send(id, now);
		}
	}

	/**
	 * Sends the registration when it still waits and is due. One at a time, so the job and a new registration never
	 * send the same one together.
	 */
	synchronized void send(UUID id, Instant now) {
		Optional<Attempt> attempt = transactions.execute(status -> registrations.findById(id)
			.filter(held -> LumaRegistration.WAITING.equals(held.getSendState()) && !held.getNextAttemptAt().isAfter(now))
			.flatMap(held -> programs.findById(held.getProgramId())
				.map(program -> new Attempt(held.getEmail(), held.getName(), held.getAnswers(), held.getStatus(),
						program.getLumaEventId(), held.getAttempts()))));
		if (attempt == null || attempt.isEmpty()) {
			return;
		}
		Attempt sending = attempt.get();
		String key = connections.current().map(LumaConnection::getApiKey).map(keys::open).orElse(null);
		if (key == null || sending.eventId() == null) {
			retry(id, sending, "No Luma calendar is connected", now);
			return;
		}
		try {
			// The status is worked out again from the event as it is now: the registration may have been kept
			// while Luma could not be read, or the host may have turned approval on or filled the event since.
			Optional<LumaGuest.Status> current = api.event(key, sending.eventId())
				.map(event -> event.form())
				.flatMap(form -> form == null ? Optional.empty() : form.statusOnAdding());
			if (current.isEmpty()) {
				stop(id, "The event takes no more registrations");
				return;
			}
			LumaGuest.Status asked = current.get();
			if (api.addGuest(key, sending.eventId(), sending.email(), sending.name(), answers(sending.answers()),
					asked)) {
				stop(id, "Luma skipped this address: it unsubscribed from the calendar, or was removed or blocked");
				return;
			}
			Optional<LumaGuest> guest = guest(key, sending.eventId(), sending.email());
			transactions.executeWithoutResult(status -> registrations.findForUpdate(id).ifPresent(held -> {
				held.sent(guest.map(LumaGuest::id).orElse(null),
						guest.map(LumaGuest::status).orElse(asked).value(),
						guest.map(LumaGuest::checkIn).orElse(null), now);
				tell(held);
			}));
			LOG.atInfo()
				.addKeyValue("event", "program.luma.registration_sent")
				.addKeyValue("registration_id", id)
				.log("A registration reached Luma");
		}
		catch (LumaApi.Refused refused) {
			stop(id, "Luma refused the answers");
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.registration_failed")
				.addKeyValue("registration_id", id)
				.addKeyValue("error_type", failed.getClass().getName())
				.log("A registration could not be sent to Luma");
			retry(id, sending, failed instanceof LumaApi.KeyRefused ? "Luma refused the key" : "Luma did not answer",
					now);
		}
	}

	/** What one attempt sends, read before Luma is called. */
	private record Attempt(String email, String name, String answers, String status, @Nullable String eventId,
			int attempts) {
	}

	/** The guest Luma added in the background, looked for a few times. */
	private Optional<LumaGuest> guest(String key, String eventId, String email) throws IOException {
		for (int look = 1; look <= LOOKS; look++) {
			Optional<LumaGuest> guest = api.guest(key, eventId, email);
			if (guest.isPresent() || look == LOOKS) {
				return guest;
			}
			try {
				Thread.sleep(BETWEEN_LOOKS);
			}
			catch (InterruptedException stopped) {
				Thread.currentThread().interrupt();
				return Optional.empty();
			}
		}
		return Optional.empty();
	}

	private void retry(UUID id, Attempt attempt, String error, Instant now) {
		if (attempt.attempts() >= WAITS.size()) {
			stop(id, error);
			return;
		}
		transactions.executeWithoutResult(status -> registrations.findForUpdate(id)
			.ifPresent(held -> held.retryAfter(WAITS.get(attempt.attempts()), error, now)));
	}

	private void stop(UUID id, String error) {
		transactions.executeWithoutResult(status -> registrations.findForUpdate(id).ifPresent(held -> held.failed(error)));
		LOG.atWarn()
			.addKeyValue("event", "program.luma.registration_stopped")
			.addKeyValue("registration_id", id)
			.log("Sending a registration to Luma stopped");
	}

	/** Emails the person the status Luma gave, once for each status. A declined one is told in a later change. */
	private void tell(LumaRegistration registration) {
		if (registration.getStatus().equals(registration.getEmailedStatus())) {
			return;
		}
		Program program = programs.findById(registration.getProgramId()).orElse(null);
		ProgramEvent event = program == null ? null : program.getEvents().stream().findFirst().orElse(null);
		if (program == null || event == null) {
			return;
		}
		ZoneId zone = LumaForm.parse(program.getLumaForm()).map(form -> ZoneId.of(form.zone())).orElse(ZoneId.of("UTC"));
		String when = WHEN.format(event.startsAt().atZone(zone));
		LumaGuest.Status status = LumaGuest.Status.valueOf(registration.getStatus().toUpperCase(Locale.ROOT));
		switch (status) {
			case PENDING_APPROVAL -> email.sendEventRegistrationReceived(registration.getEmail(), program.getName(), when,
					EventRegistrations.location(program, event, false), program.getSlug());
			case WAITLIST -> email.sendEventRegistrationWaitlisted(registration.getEmail(), program.getName(), when,
					EventRegistrations.location(program, event, false), program.getSlug());
			case APPROVED -> email.sendEventRegistrationConfirmed(registration.getEmail(), program.getName(), when,
					EventRegistrations.location(program, event, true), program.getSlug(), registration.getTicket(),
					registration.getCheckInUrl() != null);
			case DECLINED, INVITED -> {
				return;
			}
		}
		registration.emailed();
	}

	/** The answers kept with their questions, as Luma takes them. */
	private static List<LumaApi.Answer> answers(String kept) {
		List<Map<String, Object>> answers = JSON.readValue(kept, new TypeReference<>() {
		});
		return answers.stream()
			.map(answer -> new LumaApi.Answer(String.valueOf(answer.get("questionId")), answer.get("value")))
			.toList();
	}

}
