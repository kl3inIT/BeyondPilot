package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

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
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Creates an event for an operator, from the operators' MCP server (BEY-250): on the connected Luma calendar, kept
 * private, with its page here made at once by the calendar read; or on BeyondPilot alone, as Admin › Programs › New
 * makes a program. Either is a draft nobody sees until an operator publishes it.
 */
@Service
public class EventCreation {

	/** The question types an event created here asks, each as Luma names it. */
	private static final Map<String, String> TYPES = Map.of("text", "text", "long_text", "text", "select", "select",
			"multi_select", "select", "url", "url", "linkedin", "linkedin", "agree", "agree-check", "company",
			"company");

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

	/** The event made, and where to find it. */
	public record CreatedEvent(@Nullable UUID programId, @Nullable String slug, String name,
			@Nullable String lumaEventId) {
	}

	/** The question types {@link #onLuma} takes. */
	public static Set<String> questionTypes() {
		return TYPES.keySet();
	}

	/**
	 * Creates the event on Luma, private, then its page here as a draft. When Luma has the event but it cannot be read
	 * back now, the page follows at the next read and the answer holds no program.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when no calendar is connected, or Luma refuses the key or the event, or cannot be
	 * reached
	 * @throws IllegalArgumentException when a question is not one the form asks
	 */
	public CreatedEvent onLuma(Actor actor, NewEvent event) {
		Operator operator = identity.requireOperator(actor);
		List<LumaApi.NewQuestion> questions = questions(event.questions());
		String key = connections.current().map(LumaConnection::getApiKey).map(keys::open).orElse(null);
		if (key == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to create an event on");
		}
		String name = properties.createdName(event.name().strip());
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
		String slug = transactions.execute(status -> {
			audit.record(new AuditRecord(AuditAction.PROGRAM_LUMA_EVENT_CREATE,
					new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
					new AuditRecord.Resource("program", brought.map(UUID::toString).orElse(eventId), name),
					Map.of("event", eventId)));
			return brought.flatMap(programs::findById).map(held -> held.getSlug()).orElse(null);
		});
		return new CreatedEvent(brought.orElse(null), slug, name, eventId);
	}

	/**
	 * Creates the event on BeyondPilot alone, as a draft program of type event with its session, its page here, or
	 * Luma's or another site's when people register there.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ConstraintViolationException when the event holds what the admin screen's form does not allow
	 */
	@Transactional
	public CreatedEvent here(Actor actor, NewEvent event) {
		identity.requireOperator(actor);
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
		return new CreatedEvent(created.id(), slug, name, null);
	}

	/** The description, with the venue and the meeting link the page has no field for. */
	private static @Nullable String about(NewEvent event) {
		List<String> parts = new ArrayList<>();
		if (event.description() != null) {
			parts.add(event.description());
		}
		if (event.venue() != null) {
			parts.add("**Where:** " + event.venue());
		}
		if (event.meetingUrl() != null) {
			parts.add("**Join online:** " + event.meetingUrl());
		}
		return parts.isEmpty() ? null : String.join("\n\n", parts);
	}

	private static List<LumaApi.NewQuestion> questions(List<Question> asked) {
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
	private <T> T valid(T request) {
		Set<ConstraintViolation<T>> violations = validator.validate(request);
		if (!violations.isEmpty()) {
			throw new ConstraintViolationException(violations);
		}
		return request;
	}

}
