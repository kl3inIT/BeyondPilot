package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.annotation.PreDestroy;

import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaGuest;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import ai.genaifund.beyondpilot.program.persistence.LumaRegistrationRepository;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Brings back what GenAI Fund decides on Luma about the guests registered here (BEY-245): approved, declined, or moved
 * to or from the waitlist. A guest webhook only makes the event's guests be read again from Luma, whatever it says;
 * every hour the guests of events still to come are read too, for a delivery that was lost. Each change is kept on the
 * registration, so the event's page shows it. BeyondPilot emails nobody about it: Luma emails the guest of a decision
 * made on Luma, and a second email would say the same.
 */
@Component
class RegistrationDecisions {

	private static final Logger LOG = LoggerFactory.getLogger(RegistrationDecisions.class);

	private final LumaRegistrationRepository registrations;

	private final ProgramRepository programs;

	private final LumaConnectionRepository connections;

	private final LumaKeys keys;

	private final TransactionTemplate transactions;

	private final LumaApi api;

	/** Reads an event's guests away from the delivery that asked for it. */
	private final ExecutorService soon = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("luma-guests").factory());

	/** Whether the webhook was given the guest events in this run, for one made before it listened to them. */
	private final AtomicBoolean hooked = new AtomicBoolean();

	RegistrationDecisions(LumaRegistrationRepository registrations, ProgramRepository programs,
			LumaConnectionRepository connections, LumaKeys keys, LumaProperties properties,
			TransactionTemplate transactions) {
		this.registrations = registrations;
		this.programs = programs;
		this.connections = connections;
		this.keys = keys;
		this.transactions = transactions;
		this.api = new LumaApi(properties.api(), properties.timeout());
	}

	/** Reads the guests of the Luma event soon. */
	void checkSoon(String eventId) {
		soon.execute(() -> check(eventId, Instant.now()));
	}

	@PreDestroy
	void stop() {
		soon.shutdownNow();
	}

	/** Reads the guests of every event still to come that someone registered for here. */
	@Scheduled(fixedDelayString = "${beyondpilot.program.luma.decision-interval:1h}", initialDelay = 120_000)
	void checkEvery() {
		Instant now = Instant.now();
		listenToGuests();
		for (UUID programId : registrations.findProgramsWithSent()) {
			programs.findById(programId)
				.filter(program -> program.getLumaEventId() != null && comingUp(program, now))
				.map(Program::getLumaEventId)
				.ifPresent(eventId -> check(eventId, now));
		}
	}

	/**
	 * Reads the event's guests from Luma and keeps on each registration here the guest Luma holds for it, by the
	 * guest's identifier or, while it has none, by address.
	 */
	synchronized void check(String eventId, Instant now) {
		Program program = programs.findByLumaEventId(eventId).orElse(null);
		String key = key();
		if (program == null || key == null) {
			return;
		}
		List<UUID> sent = registrations.findSentOf(program.getId());
		if (sent.isEmpty()) {
			return;
		}
		List<LumaGuest> guests;
		try {
			guests = api.guests(key, eventId);
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.guests_failed")
				.addKeyValue("luma_event_id", eventId)
				.addKeyValue("error_type", failed.getClass().getName())
				.log("The guests of a Luma event could not be read");
			return;
		}
		Map<String, LumaGuest> byId = new HashMap<>();
		Map<String, LumaGuest> byEmail = new HashMap<>();
		for (LumaGuest guest : guests) {
			byId.put(guest.id(), guest);
			if (guest.email() != null) {
				byEmail.put(guest.email().toLowerCase(Locale.ROOT), guest);
			}
		}
		int changed = 0;
		for (UUID id : sent) {
			Boolean done = transactions.execute(status -> registrations.findForUpdate(id).map(held -> {
				String guestId = held.getLumaGuestId();
				LumaGuest guest = guestId != null ? byId.get(guestId)
						: byEmail.get(held.getEmail().toLowerCase(Locale.ROOT));
				if (guest == null || !held.readOnLuma(guest.id(), guest.status().value(), guest.checkIn())) {
					return false;
				}
				// Luma told the guest; the status counts as told, so nothing here repeats it.
				held.emailed();
				return true;
			}).orElse(false));
			if (Boolean.TRUE.equals(done)) {
				changed++;
			}
		}
		if (changed > 0) {
			LOG.atInfo()
				.addKeyValue("event", "program.luma.guests_read")
				.addKeyValue("luma_event_id", eventId)
				.addKeyValue("changed", changed)
				.log("Decisions made on Luma were brought back");
		}
	}

	/** Makes the webhook send the guest events too, once a run, for a calendar connected before it did. */
	private void listenToGuests() {
		if (hooked.get()) {
			return;
		}
		LumaConnection connection = connections.current().orElse(null);
		String key = key();
		if (connection == null || connection.getWebhookId() == null || key == null) {
			return;
		}
		try {
			api.updateWebhook(key, connection.getWebhookId());
			hooked.set(true);
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.webhook_not_updated")
				.addKeyValue("error_type", failed.getClass().getName())
				.log("The Luma webhook could not be given the guest events");
		}
	}

	private @Nullable String key() {
		return connections.current().map(LumaConnection::getApiKey).map(keys::open).orElse(null);
	}

	/** Whether the program's event has not ended. */
	private static boolean comingUp(Program program, Instant now) {
		return program.getEvents()
			.stream()
			.map(event -> event.endsAt() == null ? event.startsAt() : event.endsAt())
			.anyMatch(end -> end.isAfter(now));
	}

}
