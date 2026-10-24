package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaEvent;
import ai.genaifund.beyondpilot.program.luma.LumaGuest;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.persistence.LumaRegistrationRepository;
import ai.genaifund.beyondpilot.program.persistence.Program;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The guests of an event of the Luma calendar, for an operator on the operators' MCP server (BEY-250): who registered,
 * with what they answered, and the decision on each, made on Luma as an operator makes it there. Luma emails the guest
 * of the decision, as it does for one made on Luma, and the registration here is read again soon so its page shows it.
 */
@Service
public class EventGuests {

	private final IdentityService identity;

	private final EventCreation creation;

	private final EventChanges changes;

	private final RegistrationDecisions decisions;

	private final LumaRegistrationRepository registrations;

	private final AuditTrail audit;

	private final TransactionTemplate transactions;

	private final LumaApi api;

	EventGuests(IdentityService identity, EventCreation creation, EventChanges changes,
			RegistrationDecisions decisions, LumaRegistrationRepository registrations, AuditTrail audit,
			TransactionTemplate transactions, LumaProperties properties) {
		this.identity = identity;
		this.creation = creation;
		this.changes = changes;
		this.decisions = decisions;
		this.registrations = registrations;
		this.audit = audit;
		this.transactions = transactions;
		this.api = new LumaApi(properties.api(), properties.timeout());
	}

	/**
	 * The guests of an event.
	 * @param here whether the guest registered on BeyondPilot rather than on Luma
	 */
	public record Guest(String id, @Nullable String email, @Nullable String name, String status,
			@Nullable Instant registeredAt, boolean here, List<Answer> answers) {
	}

	/** A question of the form and the guest's answer, written out. */
	public record Answer(String question, String answer) {
	}

	/** The guest list of a program's event. */
	public record GuestList(UUID programId, String slug, String name, String lumaEventId, List<Guest> guests) {
	}

	/**
	 * The guests of the event, those with the status given only when one is.
	 * @param reference as {@link EventChanges#change} takes it
	 * @param status {@code pending_approval}, {@code approved}, {@code waitlist}, {@code declined} or
	 * {@code invited}; null for every guest
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when there is no such program or calendar event, or Luma refuses the key or cannot be
	 * reached
	 * @throws IllegalArgumentException when the event is not on Luma, or the status is not one of Luma's
	 */
	public GuestList guests(Actor actor, String reference, @Nullable String status) {
		identity.requireOperator(actor);
		Program program = changes.program(reference);
		String eventId = lumaEvent(program);
		LumaGuest.Status only = status == null ? null : status(status, true);
		String key = key();
		List<LumaApi.GuestEntry> entries;
		try {
			entries = api.guestEntries(key, eventId, only);
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (IOException failed) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not give the guests", failed);
		}
		Set<String> registeredHere = new HashSet<>(registrations.findEmailsOf(program.getId()));
		List<Guest> guests = entries.stream()
			.map(entry -> new Guest(entry.id(), entry.email(), entry.name(), entry.status(), entry.registeredAt(),
					entry.email() != null && registeredHere.contains(entry.email().toLowerCase(Locale.ROOT)),
					entry.answers().stream().map(answer -> new Answer(answer.label(), answer.answer())).toList()))
			.toList();
		return new GuestList(program.getId(), program.getSlug(), program.getName(), eventId, guests);
	}

	/** The guest after the decision. */
	public record Decided(UUID programId, String slug, String guestId, @Nullable String email, String before,
			String status, boolean emailed) {
	}

	/**
	 * Moves a guest of the event to the status on Luma, and reads the event's guests again soon so the registration
	 * here follows. The same status again changes nothing and emails nobody.
	 * @param guest the guest's address or Luma's {@code gst-} identifier
	 * @param status {@code approved}, {@code declined}, {@code waitlist} or {@code pending_approval}
	 * @param message a note Luma puts in its email, at most 200 characters
	 * @param emailGuest whether Luma emails the guest of it
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when there is no such program or calendar event, or Luma refuses the key or the status,
	 * or cannot be reached
	 * @throws IllegalArgumentException when the event is not on Luma or another host runs it, the event has no such
	 * guest, or the status or the message is not one Luma takes
	 */
	public Decided decide(Actor actor, String reference, String guest, String status, @Nullable String message,
			boolean emailGuest) {
		Operator operator = identity.requireOperator(actor);
		Program program = changes.program(reference);
		String eventId = lumaEvent(program);
		LumaGuest.Status to = status(status, false);
		if (message != null && message.length() > 200) {
			throw new IllegalArgumentException("Keep message to 200 characters; Luma puts it in its email.");
		}
		String key = key();
		LumaGuest held;
		try {
			Optional<LumaEvent> event = api.event(key, eventId);
			if (event.isPresent() && event.get().listed()) {
				throw new IllegalArgumentException("Another host runs this event on Luma and only lists it on "
						+ "GenAI Fund's calendar; only they decide its guests.");
			}
			held = api.guest(key, eventId, guest.strip())
				.orElseThrow(() -> new IllegalArgumentException("This event has no guest " + guest.strip()
						+ ". Read its guests with list_event_guests."));
			if (held.status() == to) {
				return new Decided(program.getId(), program.getSlug(), held.id(), held.email(), to.value(), to.value(),
						false);
			}
			api.updateGuestStatus(key, eventId, held.id(), to, message, emailGuest);
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (LumaApi.Refused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_EVENT_REFUSED, "Luma refused a guest's status", refused);
		}
		catch (IOException failed) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not change the guest", failed);
		}
		String guestId = held.id();
		transactions.executeWithoutResult(state -> audit.record(new AuditRecord(AuditAction.PROGRAM_LUMA_GUEST_DECIDE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("program", program.getId().toString(), program.getName()),
				Map.of("event", eventId, "guest", guestId, "status", to.value()))));
		decisions.checkSoon(eventId);
		return new Decided(program.getId(), program.getSlug(), guestId, held.email(), held.status().value(),
				to.value(), emailGuest);
	}

	private static String lumaEvent(Program program) {
		String eventId = program.getLumaEventId();
		if (eventId == null) {
			throw new IllegalArgumentException("This event is on BeyondPilot alone; people register for it on "
					+ "another site, which holds its guests.");
		}
		return eventId;
	}

	private String key() {
		String key = creation.key();
		if (key == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to read guests on");
		}
		return key;
	}

	/** The status Luma names so; {@code invited} only to read by. */
	private static LumaGuest.Status status(String given, boolean reading) {
		for (LumaGuest.Status status : LumaGuest.Status.values()) {
			if (status.value().equals(given.strip()) && (reading || status != LumaGuest.Status.INVITED)) {
				return status;
			}
		}
		throw new IllegalArgumentException(reading
				? "Give status as pending_approval, approved, waitlist, declined or invited."
				: "Give status as approved, declined, waitlist or pending_approval.");
	}

}
