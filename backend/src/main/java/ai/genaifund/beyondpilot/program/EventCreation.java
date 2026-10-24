package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.program.dto.AdminProgramResponse;
import ai.genaifund.beyondpilot.program.dto.CreateProgramRequest;
import ai.genaifund.beyondpilot.program.dto.ProgramEventEntry;
import ai.genaifund.beyondpilot.program.dto.SaveProgramRequest;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaEvent;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Creates an event for an operator, from the operators' MCP server (BEY-250): on the connected Luma calendar, kept
 * private, with its page here made at once by the calendar read; or on BeyondPilot alone, as Admin › Programs › New
 * makes a program. Either is a draft nobody sees until an operator publishes it. An event already on the calendar has
 * its page here already, with the registration form, so it is found, never made twice.
 */
@Service
public class EventCreation {

	/** The question types an event created here asks, each as Luma names it. */
	private static final Map<String, String> TYPES = Map.of("text", "text", "long_text", "text", "select", "select",
			"multi_select", "select", "url", "url", "linkedin", "linkedin", "agree", "agree-check", "company",
			"company");

	/** Luma's identifier of an event, as its manage page and its API name it. */
	private static final Pattern EVENT_ID = Pattern.compile("\\bevt-[A-Za-z0-9]+\\b");

	/** The addresses Luma's event pages are served at. */
	private static final Set<String> LUMA_HOSTS = Set.of("luma.com", "www.luma.com", "lu.ma", "www.lu.ma");

	private final IdentityService identity;

	private final LumaConnectionRepository connections;

	private final LumaKeys keys;

	private final LumaCalendar calendar;

	private final LumaProperties properties;

	private final ProgramAdministration administration;

	private final ProgramRepository programs;

	private final AuditTrail audit;

	private final Validator validator;

	private final TransactionTemplate transactions;

	private final LumaApi api;

	EventCreation(IdentityService identity, LumaConnectionRepository connections, LumaKeys keys, LumaCalendar calendar,
			LumaProperties properties, ProgramAdministration administration, ProgramRepository programs,
			AuditTrail audit, Validator validator, TransactionTemplate transactions) {
		this.identity = identity;
		this.connections = connections;
		this.keys = keys;
		this.calendar = calendar;
		this.properties = properties;
		this.administration = administration;
		this.programs = programs;
		this.audit = audit;
		this.validator = validator;
		this.transactions = transactions;
		this.api = new LumaApi(properties.api(), properties.timeout());
	}

	/**
	 * An event to create.
	 * @param venue a free-text address; null for an event online
	 * @param registrationUrl where people register, for an event on BeyondPilot alone
	 */
	public record NewEvent(String name, Instant startsAt, @Nullable Instant endsAt, ZoneId zone, @Nullable String venue,
			@Nullable String city, @Nullable String country, @Nullable String meetingUrl, @Nullable String description,
			@Nullable String summary, boolean approval, @Nullable Integer capacity, boolean waitlist,
			boolean hideVenue, List<Question> questions, @Nullable String registrationUrl) {
	}

	/**
	 * A question the form asks.
	 * @param type one of {@link #questionTypes()}
	 */
	public record Question(String label, String type, boolean required, List<String> options) {
	}

	/**
	 * The event made or found, and where to find it.
	 * @param existing true when nothing was made: the event already had its page here
	 * @param status the program's status here, {@code draft} or {@code published}; null while it has no page yet
	 */
	public record CreatedEvent(@Nullable UUID programId, @Nullable String slug, String name,
			@Nullable String lumaEventId, boolean existing, @Nullable String status) {
	}

	/** The question types {@link #onLuma} takes. */
	public static Set<String> questionTypes() {
		return TYPES.keySet();
	}

	/**
	 * Creates the event on Luma, private, then its page here as a draft. An event of the same name on the same day
	 * already on the calendar is found instead, and nothing is made. When Luma has the new event but it cannot be read
	 * back now, the page follows at the next read and the answer holds no program.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when no calendar is connected, or Luma refuses the key or the event, or cannot be
	 * reached
	 * @throws IllegalArgumentException when a question is not one the form asks
	 */
	public CreatedEvent onLuma(Actor actor, NewEvent event) {
		Operator operator = identity.requireOperator(actor);
		List<LumaApi.NewQuestion> questions = questions(event.questions());
		String key = key();
		if (key == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to create an event on");
		}
		String name = properties.createdName(event.name().strip());
		Optional<CreatedEvent> twin = sameEvent(Set.of(event.name().strip(), name),
				LocalDate.ofInstant(event.startsAt(), event.zone()));
		if (twin.isPresent()) {
			return twin.get();
		}
		String eventId;
		try {
			eventId = api.createEvent(key,
					new LumaApi.NewEvent(name, event.startsAt(), event.endsAt(), event.zone(), event.venue(),
							event.hideVenue(), event.meetingUrl(), event.description(), event.approval(),
							event.capacity(), event.waitlist(), questions));
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (LumaApi.Refused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_EVENT_REFUSED, "Luma refused an event", refused);
		}
		catch (IOException failed) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not create the event", failed);
		}
		Optional<UUID> program;
		try {
			program = calendar.bring(key, eventId);
		}
		catch (IOException | RuntimeException failed) {
			// The event is on Luma; the hourly read brings it.
			program = Optional.empty();
		}
		Optional<UUID> brought = program;
		// Luma is called outside any transaction; only the record of the creation is written in one.
		transactions.executeWithoutResult(status -> audit.record(new AuditRecord(AuditAction.PROGRAM_LUMA_EVENT_CREATE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("program", brought.map(UUID::toString).orElse(eventId), name),
				Map.of("event", eventId))));
		return brought.flatMap(programs::findById)
			.map(held -> found(held, false))
			.orElse(new CreatedEvent(null, null, name, eventId, false, null));
	}

	/**
	 * Finds the page here of an event already on the connected Luma calendar, by its link or its identifier, and
	 * brings the event from Luma now so the page says what Luma says. Nothing is created on Luma.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when no calendar is connected, Luma refuses the key or cannot be reached, or the
	 * calendar has no such event
	 * @throws IllegalArgumentException when the reference is neither a Luma link nor an event identifier
	 */
	public CreatedEvent fromLuma(Actor actor, String reference) {
		identity.requireOperator(actor);
		Reference named = Reference.of(reference)
			.orElseThrow(() -> new IllegalArgumentException("Give luma_event as the event's link on Luma, such as "
					+ "https://luma.com/event/manage/evt-… or https://luma.com/<its address>, or its evt- identifier."));
		String key = key();
		if (key == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to find an event on");
		}
		String eventId = eventId(key, named).orElseThrow(() -> notOnCalendar(reference));
		boolean held = programs.findByLumaEventId(eventId).isPresent();
		try {
			calendar.bring(key, eventId);
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (IOException failed) {
			if (!held) {
				throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not give the event", failed);
			}
		}
		return programs.findByLumaEventId(eventId)
			.map(program -> found(program, held))
			.orElseThrow(() -> notOnCalendar(reference));
	}

	/**
	 * Creates the event on BeyondPilot alone, as a draft program of type event with its session, its page here, or
	 * another site's when people register there. When people register at an event of the connected Luma calendar, its
	 * page here already exists, with the registration form; that page is found instead and nothing is made.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ConstraintViolationException when the event holds what the admin screen's form does not allow
	 */
	public CreatedEvent here(Actor actor, NewEvent event) {
		identity.requireOperator(actor);
		String registration = event.registrationUrl();
		Optional<Reference> onLuma = registration == null ? Optional.empty() : Reference.of(registration);
		String key = onLuma.isPresent() ? key() : null;
		if (onLuma.isPresent() && key != null) {
			Optional<String> eventId;
			try {
				eventId = eventId(key, onLuma.get());
			}
			catch (ProgramException unreadable) {
				// Luma cannot say now whether the calendar holds it; a page that links there is still what was asked.
				eventId = Optional.empty();
			}
			if (eventId.isPresent()) {
				return fromLuma(actor, eventId.get());
			}
		}
		return Objects.requireNonNull(transactions.execute(status -> create(actor, event)));
	}

	private CreatedEvent create(Actor actor, NewEvent event) {
		String name = event.name().strip();
		String base = LumaCalendar.slugOf(name);
		String slug = LumaCalendar.freeSlug(base.isEmpty() ? "event" : base.length() < 3 ? "event-" + base : base,
				programs);
		AdminProgramResponse created = administration.create(actor, valid(new CreateProgramRequest(name, slug, "event")));
		boolean online = event.venue() == null && event.city() == null;
		String registration = event.registrationUrl();
		ProgramEventEntry session = new ProgramEventEntry(name, event.startsAt(), event.endsAt(), online, event.city(),
				event.country(), registration);
		LocalDate starts = LocalDate.ofInstant(event.startsAt(), event.zone());
		LocalDate ends = event.endsAt() == null ? starts : LocalDate.ofInstant(event.endsAt(), event.zone());
		administration.save(actor, created.id(),
				valid(new SaveProgramRequest(created.version(), name, slug, "event", null, event.summary(),
						about(event), starts, ends, registration == null ? "standard" : "external", registration,
						null, null, List.of(), List.of(session))));
		return new CreatedEvent(created.id(), slug, name, null, false, "draft");
	}

	/**
	 * A page here of an event on the calendar that starts on the same day under one of the names, ignoring case: the
	 * name asked for, or the one Luma is given in this environment.
	 */
	private Optional<CreatedEvent> sameEvent(Set<String> names, LocalDate day) {
		return programs.findByLumaEventIdNotNull()
			.stream()
			.filter(program -> day.equals(program.getStartsOn())
					&& names.stream().anyMatch(name -> program.getName().strip().equalsIgnoreCase(name)))
			.findFirst()
			.map(program -> found(program, true));
	}

	/**
	 * The Luma event a reference names, when the calendar holds it: by identifier, or by the address of its page on
	 * Luma among the events the calendar lists.
	 */
	Optional<String> eventId(String key, Reference reference) {
		try {
			if (reference.eventId() != null) {
				return api.event(key, reference.eventId()).map(LumaEvent::id);
			}
			String path = reference.path();
			Optional<String> held = programs.findByLumaEventIdNotNull()
				.stream()
				.filter(program -> path.equals(Reference.lastSegment(program.getExternalUrl())))
				.map(Program::getLumaEventId)
				.filter(Objects::nonNull)
				.findFirst();
			if (held.isPresent()) {
				return held;
			}
			return api.events(key)
				.stream()
				.filter(event -> path.equals(Reference.lastSegment(event.page().toString())))
				.map(LumaEvent::id)
				.findFirst();
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (IOException failed) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma could not be asked for an event",
					failed);
		}
	}

	private CreatedEvent found(Program program, boolean existing) {
		return new CreatedEvent(program.getId(), program.getSlug(), program.getName(), program.getLumaEventId(), existing,
				program.getStatus().code());
	}

	@Nullable String key() {
		return connections.current().map(LumaConnection::getApiKey).map(keys::open).orElse(null);
	}

	static ProgramException notOnCalendar(String reference) {
		return new ProgramException(ProgramErrorCode.LUMA_EVENT_NOT_FOUND,
				"No event of the connected calendar for " + reference);
	}

	/**
	 * What a reference to a Luma event names: its identifier, or the last part of the address of its page.
	 * @param path lowercase, set when the identifier is not given
	 */
	record Reference(@Nullable String eventId, String path) {

		/** The reference in an identifier or a link of Luma's; empty for any other text. */
		static Optional<Reference> of(String given) {
			Matcher id = EVENT_ID.matcher(given);
			if (id.find()) {
				return Optional.of(new Reference(id.group(), ""));
			}
			URI address;
			try {
				address = URI.create(given.strip());
			}
			catch (IllegalArgumentException notOne) {
				return Optional.empty();
			}
			String host = address.getHost();
			String path = lastSegment(given.strip());
			if (host == null || !LUMA_HOSTS.contains(host.toLowerCase(Locale.ROOT)) || path == null) {
				return Optional.empty();
			}
			return Optional.of(new Reference(null, path));
		}

		/** The last part of an address's path, lowercase; null when it has none. */
		static @Nullable String lastSegment(@Nullable String address) {
			if (address == null) {
				return null;
			}
			String path;
			try {
				path = URI.create(address.strip()).getPath();
			}
			catch (IllegalArgumentException notOne) {
				return null;
			}
			if (path == null) {
				return null;
			}
			String trimmed = path.replaceAll("/+$", "");
			String last = trimmed.substring(trimmed.lastIndexOf('/') + 1);
			return last.isEmpty() ? null : last.toLowerCase(Locale.ROOT);
		}

	}

	/** The description, with the venue and the meeting link the page has no field for. */
	private static @Nullable String about(NewEvent event) {
		return about(event.description(), event.venue(), event.meetingUrl());
	}

	/** The description, with the venue and the meeting link the page has no field for. */
	static @Nullable String about(@Nullable String description, @Nullable String venue, @Nullable String meetingUrl) {
		List<String> parts = new ArrayList<>();
		if (description != null) {
			parts.add(description);
		}
		if (venue != null) {
			parts.add("**Where:** " + venue);
		}
		if (meetingUrl != null) {
			parts.add("**Join online:** " + meetingUrl);
		}
		return parts.isEmpty() ? null : String.join("\n\n", parts);
	}

	static List<LumaApi.NewQuestion> questions(List<Question> asked) {
		List<LumaApi.NewQuestion> questions = new ArrayList<>();
		for (Question question : asked) {
			String type = TYPES.get(question.type());
			if (type == null) {
				throw new IllegalArgumentException("Give each question's type as one of " + questionTypes() + ".");
			}
			boolean choice = type.equals("select");
			if (choice && question.options().size() < 2) {
				throw new IllegalArgumentException("Give a select question at least two options.");
			}
			questions.add(new LumaApi.NewQuestion("bp-" + (questions.size() + 1), question.label().strip(), type,
					question.required(), question.type().equals("long_text"), choice ? question.options() : List.of(),
					question.type().equals("multi_select")));
		}
		return questions;
	}

	/** The request, when it holds what the admin screen's form allows. */
	<T> T valid(T request) {
		Set<ConstraintViolation<T>> violations = validator.validate(request);
		if (!violations.isEmpty()) {
			throw new ConstraintViolationException(violations);
		}
		return request;
	}

}
