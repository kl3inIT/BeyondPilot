package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.program.dto.EventQuestionEntry;
import ai.genaifund.beyondpilot.program.dto.EventRegistrationResponse;
import ai.genaifund.beyondpilot.program.dto.RegisterForEventRequest;
import ai.genaifund.beyondpilot.program.luma.CheckInCode;
import ai.genaifund.beyondpilot.program.luma.EventCalendar;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaEvent;
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
import ai.genaifund.beyondpilot.program.persistence.ProgramStatus;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * People register for GenAI Fund's Luma events on BeyondPilot (BEY-245). The form is the event's own on Luma; the
 * questions are read again before a registration is accepted, and the answers are checked here, since Luma checks none.
 * A registration is kept first and sent to Luma after, by {@link RegistrationSender}, so Luma being down loses nothing.
 */
@Service
public class EventRegistrations {

	private static final SecureRandom RANDOM = new SecureRandom();

	private final ProgramRepository programs;

	private final LumaRegistrationRepository registrations;

	private final LumaConnectionRepository connections;

	private final LumaKeys keys;

	private final LumaCalendar calendar;

	private final RegistrationSender sender;

	private final IdentityService identity;

	private final LumaProperties properties;

	private final LumaApi api;

	private final TransactionTemplate transactions;

	EventRegistrations(ProgramRepository programs, LumaRegistrationRepository registrations,
			LumaConnectionRepository connections, LumaKeys keys, LumaCalendar calendar, RegistrationSender sender,
			IdentityService identity, LumaProperties properties, TransactionTemplate transactions) {
		this.programs = programs;
		this.registrations = registrations;
		this.connections = connections;
		this.keys = keys;
		this.calendar = calendar;
		this.sender = sender;
		this.identity = identity;
		this.properties = properties;
		this.api = new LumaApi(properties.api(), properties.timeout());
		this.transactions = transactions;
	}

	/**
	 * The event's form and, for a signed-in person, their registration. The venue and the call Luma keeps for guests are
	 * given only to a confirmed one.
	 * @throws ProgramException {@code PROGRAM_NOT_FOUND} when no such program is public, {@code REGISTRATION_NOT_HERE}
	 * when people register for it on Luma
	 */
	@Transactional(readOnly = true)
	public EventRegistrationResponse registration(String slug, @Nullable Actor actor) {
		Program program = visible(slug, actor);
		LumaForm form = formOf(program);
		LumaRegistration mine = actor == null ? null
				: registrations.findByProgramIdAndAccountId(program.getId(), actor.accountId()).orElse(null);
		return response(form, mine);
	}

	/**
	 * Registers the caller for the event with the name and answers given, against the questions as they stand on Luma.
	 * @throws ProgramException {@code REGISTRATION_NOT_HERE}; {@code REGISTRATION_EXISTS} when the caller already
	 * registered; {@code REGISTRATION_FORM_CHANGED} when the host changed the questions since the form was shown;
	 * {@code REGISTRATION_CLOSED} when the event takes no more; {@code REGISTRATION_ANSWERS_INVALID}
	 */
	public EventRegistrationResponse register(Actor actor, String slug, RegisterForEventRequest request) {
		identity.requireActive(actor);
		Person person = identity.person(actor);
		Program program = Objects.requireNonNull(transactions.execute(status -> visible(slug, actor)));
		LumaForm form = current(program, formOf(program));
		if (registrations.findByProgramIdAndAccountId(program.getId(), actor.accountId()).isPresent()) {
			throw new ProgramException(ProgramErrorCode.REGISTRATION_EXISTS, "Already registered");
		}
		if (!form.version().equals(request.formVersion())) {
			throw new ProgramException(ProgramErrorCode.REGISTRATION_FORM_CHANGED, "The form was filled against "
					+ request.formVersion() + ", not " + form.version());
		}
		LumaGuest.Status status = form.statusOnAdding()
			.orElseThrow(() -> new ProgramException(ProgramErrorCode.REGISTRATION_CLOSED, "Registration is closed"));
		String name = request.name().strip();
		RegistrationAnswers answers = RegistrationAnswers.check(form, request.answers(), name, person.email());
		LumaRegistration registration = new LumaRegistration(program.getId(), actor.accountId(), person.email(), name,
				answers.kept(), form.version(), status.value(), ticket(), Instant.now());
		try {
			transactions.executeWithoutResult(done -> registrations.saveAndFlush(registration));
		}
		catch (DataIntegrityViolationException twice) {
			throw new ProgramException(ProgramErrorCode.REGISTRATION_EXISTS, "Registered at the same moment", twice);
		}
		sender.sendSoon(registration.getId());
		return response(form, registration);
	}

	/** The check-in code of a confirmed guest, by their ticket; empty for any other. */
	@Transactional(readOnly = true)
	public Optional<byte[]> checkInImage(String ticket) {
		return confirmed(ticket).map(LumaRegistration::getCheckInUrl).map(CheckInCode::png);
	}

	/** The event as a calendar file for a confirmed guest, by their ticket; empty for any other. */
	@Transactional(readOnly = true)
	public Optional<String> calendarFile(String ticket) {
		return confirmed(ticket).flatMap(registration -> programs.findById(registration.getProgramId())
			.flatMap(program -> program.getEvents().stream().findFirst().map(event -> {
				return EventCalendar.of(registration.getId() + "@beyondpilot", program.getName(), event.startsAt(),
						event.endsAt(), location(program, event, true),
						properties.siteUrl() + "/programs/" + program.getSlug(), Instant.now());
			})));
	}

	private Optional<LumaRegistration> confirmed(String ticket) {
		return registrations.findByTicket(ticket)
			.filter(registration -> LumaRegistration.SENT.equals(registration.getSendState())
					&& LumaGuest.Status.APPROVED.value().equals(registration.getStatus()));
	}

	/**
	 * Where the event is held, in words: for a confirmed guest the venue or the call Luma keeps for guests, for anyone
	 * the city and country; null for an event online that has no call.
	 */
	static @Nullable String location(Program program, ProgramEvent event, boolean confirmed) {
		LumaForm form = LumaForm.parse(program.getLumaForm()).orElse(null);
		if (form != null && (confirmed || !form.placeForGuests())) {
			String place = form.venue() != null ? form.venue() : form.meetingUrl();
			if (place != null) {
				return place;
			}
		}
		String place = String.join(", ", Stream.of(event.city(), event.country()).filter(Objects::nonNull).toList());
		return place.isEmpty() ? null : place;
	}

	private Program visible(String slug, @Nullable Actor actor) {
		return programs.findBySlug(slug)
			.filter(found -> found.getStatus() == ProgramStatus.PUBLISHED || (actor != null && identity.isOperator(actor)))
			.orElseThrow(() -> new ProgramException(ProgramErrorCode.PROGRAM_NOT_FOUND, "No public program " + slug));
	}

	private LumaForm formOf(Program program) {
		String eventId = program.getLumaEventId();
		return LumaForm.parse(program.getLumaForm())
			.filter(form -> eventId != null && properties.registersHere(eventId))
			.orElseThrow(() -> new ProgramException(ProgramErrorCode.REGISTRATION_NOT_HERE,
					"People register for " + program.getSlug() + " on Luma"));
	}

	/**
	 * The form as Luma has it now. When Luma cannot be read the form last read stands; when it changed, the calendar is
	 * read again soon so the page shows it too.
	 */
	private LumaForm current(Program program, LumaForm held) {
		String eventId = Objects.requireNonNull(program.getLumaEventId());
		Optional<LumaConnection> connection = connections.current();
		String key = connection.map(LumaConnection::getApiKey).map(keys::open).orElse(null);
		if (key == null) {
			return held;
		}
		Optional<LumaEvent> event;
		try {
			event = api.event(key, eventId);
		}
		catch (IOException unreachable) {
			return held;
		}
		LumaForm form = event.map(LumaEvent::form)
			.orElseThrow(() -> new ProgramException(ProgramErrorCode.REGISTRATION_NOT_HERE,
					"The event no longer takes registrations here"));
		if (!form.equals(held)) {
			calendar.readSoon();
		}
		return form;
	}

	private EventRegistrationResponse response(LumaForm form, @Nullable LumaRegistration mine) {
		boolean confirmed = mine != null && LumaRegistration.SENT.equals(mine.getSendState())
				&& LumaGuest.Status.APPROVED.value().equals(mine.getStatus());
		boolean shown = confirmed || !form.placeForGuests();
		return new EventRegistrationResponse(form.version(), form.state().name().toLowerCase(Locale.ROOT),
				form.approval(), form.zone(), form.hosts(),
				form.questions()
					.stream()
					.map(question -> new EventQuestionEntry(question.id(), question.label(), question.type().value(),
							question.required(), question.multiline(), question.options(), question.multiple(),
							question.jobTitle(), question.termsUrl(), question.termsText(),
							question.known().map(known -> known.name().toLowerCase(Locale.ROOT)).orElse(null)))
					.toList(),
				shown ? form.venue() : null, shown ? form.meetingUrl() : null, !shown,
				mine == null ? null : mine(mine, confirmed));
	}

	private EventRegistrationResponse.Mine mine(LumaRegistration registration, boolean confirmed) {
		String status = LumaRegistration.SENT.equals(registration.getSendState()) ? registration.getStatus()
				: "received";
		String tickets = properties.siteUrl() + "/api/program/tickets/" + registration.getTicket();
		return new EventRegistrationResponse.Mine(status, registration.getName(), registration.getCreatedAt(),
				confirmed && registration.getCheckInUrl() != null ? tickets + "/check-in.png" : null,
				confirmed ? tickets + "/event.ics" : null);
	}

	/** 24 random bytes, written for an address. */
	private static String ticket() {
		byte[] bytes = new byte[24];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

}
