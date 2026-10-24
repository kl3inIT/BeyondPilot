package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.program.dto.AdminProgramResponse;
import ai.genaifund.beyondpilot.program.dto.ProgramEventEntry;
import ai.genaifund.beyondpilot.program.dto.SaveProgramRequest;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaEvent;
import ai.genaifund.beyondpilot.program.luma.LumaForm;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.luma.LumaQuestion;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Changes an event for an operator, from the operators' MCP server (BEY-250). An event of the connected Luma calendar
 * is changed on Luma, the source of its page here, which is then read again at once so the page says the same. An
 * event on BeyondPilot alone is saved as Admin › Programs saves it. Given nothing to change, either is answered as it
 * stands, so an operator reads the form before replacing its questions.
 */
@Service
public class EventChanges {

	/** The paths of a program's pages here: {@code /programs/<slug>} and {@code /admin/programs/<id>}. */
	private static final String PROGRAMS = "/programs/";

	/** How many covers a search answers, enough to choose from. */
	private static final int COVERS = 8;

	/** Where Luma serves the images an event may take as its cover. */
	private static final String LUMA_IMAGES = "https://images.lumacdn.com/";

	private final IdentityService identity;

	private final EventCreation creation;

	private final LumaCalendar calendar;

	private final ProgramAdministration administration;

	private final ProgramRepository programs;

	private final AuditTrail audit;

	private final TransactionTemplate transactions;

	private final LumaApi api;

	EventChanges(IdentityService identity, EventCreation creation, LumaCalendar calendar, LumaProperties properties,
			ProgramAdministration administration, ProgramRepository programs, AuditTrail audit,
			TransactionTemplate transactions) {
		this.identity = identity;
		this.creation = creation;
		this.calendar = calendar;
		this.administration = administration;
		this.programs = programs;
		this.audit = audit;
		this.transactions = transactions;
		this.api = new LumaApi(properties.api(), properties.timeout());
	}

	/**
	 * What to change; null leaves a field as it is.
	 * @param zone the time zone of the place; for an event on BeyondPilot alone, how its new times fall on days
	 * @param capacity on Luma, the seats; 0 takes the limit away
	 * @param questions on Luma, the whole registration form, replacing it
	 * @param visibility on Luma, {@code public} or {@code private}
	 * @param approval on Luma, whether each guest waits for GenAI Fund's approval
	 * @param coverUrl on Luma, an image of Luma's own, such as one {@link #covers} finds
	 * @param emailGuests on Luma, whether Luma emails the guests of a change of name, time or place
	 * @param city for an event on BeyondPilot alone; Luma works out its own
	 * @param summary for an event on BeyondPilot alone; Luma's is taken from the description
	 * @param registrationUrl for an event on BeyondPilot alone: where people register on another site
	 */
	public record Change(@Nullable String name, @Nullable Instant startsAt, @Nullable Instant endsAt,
			@Nullable ZoneId zone, @Nullable String venue, @Nullable String meetingUrl, @Nullable Boolean hideVenue,
			@Nullable String description, @Nullable Integer capacity, @Nullable Boolean waitlist,
			@Nullable List<EventCreation.Question> questions, @Nullable String visibility,
			@Nullable Boolean approval, @Nullable String coverUrl, boolean emailGuests, @Nullable String city, @Nullable String country, @Nullable String summary,
			@Nullable String registrationUrl) {

		/** The fields given, by the names the MCP tool gives them. */
		List<String> given() {
			List<String> given = new ArrayList<>();
			add(given, "name", name);
			add(given, "starts_at", startsAt);
			add(given, "ends_at", endsAt);
			add(given, "timezone", zone);
			add(given, "venue", venue);
			add(given, "meeting_url", meetingUrl);
			add(given, "hide_venue_until_approved", hideVenue);
			add(given, "description", description);
			add(given, "capacity", capacity);
			add(given, "waitlist", waitlist);
			add(given, "questions", questions);
			add(given, "visibility", visibility);
			add(given, "require_approval", approval);
			add(given, "cover_url", coverUrl);
			add(given, "city", city);
			add(given, "country", country);
			add(given, "summary", summary);
			add(given, "registration_url", registrationUrl);
			return given;
		}

		private static void add(List<String> given, String name, @Nullable Object value) {
			if (value != null) {
				given.add(name);
			}
		}

	}

	/**
	 * The event as it stands after the change.
	 * @param changed the fields changed; empty when only read
	 * @param publishIssues what the page still lacks before it can be published
	 * @param luma the event as Luma holds it; null for an event on BeyondPilot alone, or when Luma cannot be read now
	 * @param pending true when Luma has the change but the page here follows only at the next read
	 */
	public record ChangedEvent(UUID programId, String slug, String name, @Nullable String lumaEventId, String status,
			List<String> changed, List<String> publishIssues, @Nullable OnLuma luma, boolean pending) {
	}

	/**
	 * An event as Luma holds it.
	 * @param seatsLeft null when it has no limit, or when its form is not one BeyondPilot takes
	 * @param questions what its form asks, in the types {@code create_event} takes, or Luma's own type for another;
	 * empty when its form is not one BeyondPilot takes
	 * @param formHere whether people register for it on BeyondPilot
	 */
	public record OnLuma(URI page, String visibility, Instant startsAt, @Nullable Instant endsAt, String zone,
			boolean online, @Nullable String venue, @Nullable String meetingUrl, boolean venueForGuests,
			@Nullable Integer seatsLeft, boolean waitlist, boolean approval, boolean open,
			List<EventCreation.Question> questions, boolean formHere) {
	}

	/**
	 * Changes the event, or answers it as it stands when nothing is given.
	 * @param reference the program's address, slug or identifier here, or the event's link or identifier on Luma
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when there is no such program or calendar event, the save here is refused, or Luma
	 * refuses the key or the change, or cannot be reached
	 * @throws IllegalArgumentException when the reference names nothing, the program is not an event, or a field is
	 * given that this kind of event does not take
	 */
	public ChangedEvent change(Actor actor, String reference, Change change) {
		Operator operator = identity.requireOperator(actor);
		Program program = program(reference);
		String eventId = program.getLumaEventId();
		return eventId == null ? here(actor, program, change) : onLuma(actor, operator, program.getId(), eventId, change);
	}

	/** An image of Luma's gallery of covers, which an event takes as its cover as it is. */
	public record Cover(String url, @Nullable String description) {
	}

	/**
	 * Images of Luma's gallery of covers that match the words, for an event of the calendar.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when no calendar is connected, or Luma refuses the key or cannot be reached
	 */
	public List<Cover> covers(Actor actor, String words) {
		identity.requireOperator(actor);
		String key = creation.key();
		if (key == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to find covers with");
		}
		try {
			return api.covers(key, words.strip(), COVERS)
				.stream()
				.map(cover -> new Cover(cover.url(), cover.description()))
				.toList();
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (IOException failed) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not search its covers", failed);
		}
	}

	/** The program a reference names, brought from the calendar first when Luma has it and the page is not made yet. */
	Program program(String reference) {
		String given = reference.strip();
		Optional<EventCreation.Reference> luma = EventCreation.Reference.of(given);
		if (luma.isPresent()) {
			String key = creation.key();
			if (key == null) {
				throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to change an event of");
			}
			String eventId = creation.eventId(key, luma.get()).orElseThrow(() -> EventCreation.notOnCalendar(given));
			Optional<Program> held = programs.findByLumaEventId(eventId);
			if (held.isPresent()) {
				return held.get();
			}
			try {
				calendar.bring(key, eventId);
			}
			catch (IOException failed) {
				throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not give the event", failed);
			}
			return programs.findByLumaEventId(eventId).orElseThrow(() -> EventCreation.notOnCalendar(given));
		}
		String named = given;
		int at = named.indexOf(PROGRAMS);
		if (at >= 0) {
			named = named.substring(at + PROGRAMS.length()).replaceAll("[/?#].*$", "");
		}
		else if (named.startsWith("program:")) {
			named = named.substring("program:".length());
		}
		else if (named.contains("://") || named.isBlank()) {
			throw new IllegalArgumentException(nothingNamed());
		}
		String slug = named.toLowerCase(Locale.ROOT);
		Optional<Program> found;
		try {
			found = programs.findById(UUID.fromString(slug));
		}
		catch (IllegalArgumentException notId) {
			found = programs.findBySlug(slug);
		}
		return found.orElseThrow(() -> new ProgramException(ProgramErrorCode.PROGRAM_NOT_FOUND,
				"No program for " + given));
	}

	private static String nothingNamed() {
		return "Give event as the page on BeyondPilot (https://…/programs/<its address>, program:<its address>, or "
				+ "its address), or as the event on Luma (its link or its evt- identifier).";
	}

	private ChangedEvent onLuma(Actor actor, Operator operator, UUID programId, String eventId, Change change) {
		List<String> notOnLuma = change.given()
			.stream()
			.filter(List.of("city", "country", "summary", "registration_url")::contains)
			.toList();
		if (!notOnLuma.isEmpty()) {
			throw new IllegalArgumentException("This event is on Luma, which sets its page here: leave out "
					+ String.join(", ", notOnLuma) + ". Luma works out the city and the country from the venue, and "
					+ "the card's summary from the description.");
		}
		String key = creation.key();
		if (key == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED, "No Luma calendar to change an event of");
		}
		LumaEvent before = read(key, eventId);
		if (before.listed()) {
			throw new IllegalArgumentException("Another host runs this event on Luma and only lists it on GenAI Fund's "
					+ "calendar; only they can change it.");
		}
		List<String> changed = change.given();
		if (!changed.isEmpty()) {
			LumaApi.EventChange sent = lumaChange(before, change);
			try {
				if (!List.of("require_approval").equals(changed)) {
					api.updateEvent(key, eventId, sent);
				}
				if (change.approval() != null) {
					api.requireApproval(key, eventId, change.approval());
				}
			}
			catch (LumaApi.KeyRefused refused) {
				throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
			}
			catch (LumaApi.Refused refused) {
				throw new ProgramException(ProgramErrorCode.LUMA_EVENT_REFUSED, "Luma refused a change of an event",
						refused);
			}
			catch (IOException failed) {
				throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not change the event", failed);
			}
			String name = before.name();
			transactions.executeWithoutResult(status -> audit.record(new AuditRecord(
					AuditAction.PROGRAM_LUMA_EVENT_UPDATE,
					new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
					new AuditRecord.Resource("program", programId.toString(), name), Map.of("event", eventId))));
		}
		// Read again now, so the page here says what Luma says; the webhook and the hourly read bring it otherwise.
		boolean pending;
		try {
			pending = calendar.bring(key, eventId).isEmpty();
		}
		catch (IOException | RuntimeException failed) {
			pending = true;
		}
		LumaEvent after;
		try {
			after = api.event(key, eventId).orElse(before);
		}
		catch (IOException failed) {
			after = before;
		}
		return state(actor, programId, changed, onLuma(after), pending);
	}

	/** The change as Luma takes it, checked against the event as it stands. */
	private static LumaApi.EventChange lumaChange(LumaEvent event, Change change) {
		if (change.venue() != null && change.meetingUrl() != null) {
			throw new IllegalArgumentException("Give either venue or meeting_url, not both.");
		}
		Instant starts = change.startsAt();
		Instant ends = change.endsAt();
		if (starts != null && !starts.isAfter(Instant.now())) {
			throw new IllegalArgumentException("Give starts_at in the future.");
		}
		if (starts != null && ends == null && event.endsAt() != null) {
			// The event keeps its length when only its start moves.
			ends = starts.plus(Duration.between(event.startsAt(), event.endsAt()));
		}
		if (ends != null && !ends.isAfter(starts != null ? starts : event.startsAt())) {
			throw new IllegalArgumentException("Give ends_at after the start, " + (starts != null ? starts
					: event.startsAt()) + ".");
		}
		Integer capacity = change.capacity();
		if (capacity != null && capacity < 0) {
			throw new IllegalArgumentException("Give capacity from 1, or 0 to take the limit away.");
		}
		LumaEvent.Visibility visibility = change.visibility() == null ? null : switch (change.visibility()) {
			case "public" -> LumaEvent.Visibility.PUBLIC;
			case "private" -> LumaEvent.Visibility.PRIVATE;
			default -> throw new IllegalArgumentException("Give visibility as public or private.");
		};
		List<LumaApi.NewQuestion> questions = change.questions() == null ? null
				: questions(event.form(), change.questions());
		String cover = change.coverUrl();
		if (cover != null && !cover.startsWith(LUMA_IMAGES)) {
			throw new IllegalArgumentException("Give cover_url as an image Luma serves, " + LUMA_IMAGES + "…: one "
					+ "search_event_covers found, or upload the image on Luma.");
		}
		return new LumaApi.EventChange(change.name(), starts, ends, change.zone(), change.venue(), change.hideVenue(),
				change.meetingUrl(), change.description(), capacity, change.waitlist(), questions, visibility, cover,
				change.emailGuests());
	}

	/**
	 * The new form, each question that keeps its label and its type keeping its identifier on Luma, so the answers
	 * already given to it stay with it.
	 */
	private static List<LumaApi.NewQuestion> questions(@Nullable LumaForm form,
			List<EventCreation.Question> asked) {
		if (form == null) {
			throw new IllegalArgumentException("This event's registration form is not one BeyondPilot takes, so "
					+ "people register on Luma; change its questions on Luma.");
		}
		List<LumaQuestion> current = form.questions();
		List<String> notWritten = current.stream()
			.filter(question -> !EventCreation.questionTypes().contains(type(question)))
			.map(LumaQuestion::label)
			.toList();
		if (!notWritten.isEmpty()) {
			throw new IllegalArgumentException("The form asks questions of a kind this tool cannot write ("
					+ String.join("; ", notWritten) + "); change its questions on Luma.");
		}
		List<LumaApi.NewQuestion> made = EventCreation.questions(asked);
		List<String> taken = new ArrayList<>();
		List<LumaApi.NewQuestion> questions = new ArrayList<>();
		for (LumaApi.NewQuestion question : made) {
			String id = current.stream()
				.filter(held -> !taken.contains(held.id()) && held.label().strip().equalsIgnoreCase(question.label())
						&& held.type().value().equals(question.type()))
				.map(LumaQuestion::id)
				.findFirst()
				.orElse("bp-" + HexFormat.of().toHexDigits(ThreadLocalRandom.current().nextInt()));
			taken.add(id);
			questions.add(new LumaApi.NewQuestion(id, question.label(), question.type(), question.required(),
					question.multiline(), question.options(), question.multiple()));
		}
		return questions;
	}

	/** A question's type as {@code create_event} names it, or Luma's own name for one it does not take. */
	private static String type(LumaQuestion question) {
		return switch (question.type()) {
			case TEXT -> question.multiline() ? "long_text" : "text";
			case SELECT -> question.multiple() ? "multi_select" : "select";
			case AGREE_CHECK -> "agree";
			case URL -> "url";
			case LINKEDIN -> "linkedin";
			case COMPANY -> "company";
			default -> question.type().value();
		};
	}

	private LumaEvent read(String key, String eventId) {
		try {
			return api.event(key, eventId).orElseThrow(() -> EventCreation.notOnCalendar(eventId));
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key", refused);
		}
		catch (IOException failed) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma did not give the event", failed);
		}
	}

	private static OnLuma onLuma(LumaEvent event) {
		LumaForm form = event.form();
		String visibility = switch (event.visibility()) {
			case PUBLIC -> "public";
			case MEMBERS_ONLY -> "members-only";
			case PRIVATE -> "private";
		};
		List<EventCreation.Question> questions = form == null ? List.of()
				: form.questions()
					.stream()
					.map(question -> new EventCreation.Question(question.label(), type(question), question.required(),
							question.options()))
					.toList();
		return new OnLuma(event.page(), visibility, event.startsAt(), event.endsAt(), event.zone().getId(),
				event.online(), form == null ? null : form.venue(), form == null ? null : form.meetingUrl(),
				form != null && form.placeForGuests(), form == null ? null : form.seatsLeft(),
				form != null && form.waitlist(), form != null && form.approval(), form != null && form.open(),
				questions, form != null);
	}

	/** Saves the change of an event on BeyondPilot alone, as its Settings screen would. */
	private ChangedEvent here(Actor actor, Program program, Change change) {
		List<String> lumaOnly = change.given()
			.stream()
			.filter(List.of("capacity", "waitlist", "questions", "visibility", "hide_venue_until_approved",
					"require_approval", "cover_url")::contains)
			.toList();
		if (!lumaOnly.isEmpty()) {
			throw new IllegalArgumentException("This event is on BeyondPilot alone, with no registration form here: "
					+ "leave out " + String.join(", ", lumaOnly) + ". Its cover is uploaded, and the page published, in "
					+ "Admin › Programs.");
		}
		AdminProgramResponse held = administration.get(actor, program.getId());
		if (!"event".equals(held.type())) {
			throw new IllegalArgumentException("This program is a " + held.type().replace('_', ' ')
					+ ", not an event; change it in Admin › Programs.");
		}
		List<String> changed = change.given();
		if (changed.isEmpty()) {
			return state(actor, program.getId(), changed, null, false);
		}
		if (change.venue() != null && change.meetingUrl() != null) {
			throw new IllegalArgumentException("Give either venue or meeting_url, not both.");
		}
		if ((change.venue() != null || change.meetingUrl() != null) && change.description() == null) {
			throw new IllegalArgumentException("The page keeps the venue and the join link in its description: give "
					+ "the description too, as it should read, and the venue or meeting_url is added below it.");
		}
		String registration = change.registrationUrl();
		if (registration != null) {
			String key = creation.key();
			Optional<EventCreation.Reference> luma = EventCreation.Reference.of(registration);
			if (luma.isPresent() && key != null && calendarHas(key, luma.get())) {
				throw new IllegalArgumentException("That link is an event of GenAI Fund's Luma calendar, which has "
						+ "its own page here with its registration form; change that event instead.");
			}
		}
		boolean moved = change.startsAt() != null || change.endsAt() != null;
		boolean sessionChanged = moved || change.venue() != null || change.meetingUrl() != null
				|| change.city() != null || change.country() != null || registration != null;
		List<ProgramEventEntry> sessions = held.events();
		if (sessionChanged && sessions.size() != 1) {
			throw new IllegalArgumentException("This page holds " + sessions.size() + " sessions; change their "
					+ "times and places in Admin › Programs.");
		}
		if (moved && change.zone() == null) {
			throw new IllegalArgumentException("Give timezone with the new times, so the page shows the right days.");
		}
		String name = change.name() == null ? held.name() : change.name().strip();
		List<ProgramEventEntry> events = sessions;
		LocalDate startsOn = held.startsOn();
		LocalDate endsOn = held.endsOn();
		if (sessionChanged) {
			ProgramEventEntry session = sessions.getFirst();
			Instant starts = change.startsAt() != null ? change.startsAt() : session.startsAt();
			Instant ends = change.endsAt() != null ? change.endsAt()
					: change.startsAt() != null && session.endsAt() != null
							? starts.plus(Duration.between(session.startsAt(), session.endsAt())) : session.endsAt();
			if (change.startsAt() != null && !starts.isAfter(Instant.now())) {
				throw new IllegalArgumentException("Give starts_at in the future.");
			}
			if (ends != null && !ends.isAfter(starts)) {
				throw new IllegalArgumentException("Give ends_at after the start, " + starts + ".");
			}
			boolean online = change.meetingUrl() != null || (change.venue() == null && session.online());
			String title = session.title().equals(held.name()) ? name : session.title();
			events = List.of(new ProgramEventEntry(title, starts, ends, online,
					change.city() != null ? change.city() : online ? null : session.city(),
					change.country() != null ? change.country() : online ? null : session.country(),
					registration != null ? registration : session.registrationUrl()));
			if (moved) {
				ZoneId zone = change.zone();
				startsOn = LocalDate.ofInstant(starts, zone);
				endsOn = ends == null ? startsOn : LocalDate.ofInstant(ends, zone);
			}
		}
		String about = change.description() == null ? held.about()
				: EventCreation.about(change.description(), change.venue(), change.meetingUrl());
		String pageKind = registration != null ? "external" : held.pageKind();
		String externalUrl = registration != null ? registration : held.externalUrl();
		administration.save(actor, program.getId(),
				creation.valid(new SaveProgramRequest(held.version(), name, held.slug(), held.type(),
						held.partnerName(), change.summary() != null ? change.summary() : held.summary(), about,
						startsOn, endsOn, pageKind, externalUrl, held.coverFileId(), held.applications(),
						held.keyDates(), events)));
		return state(actor, program.getId(), changed, null, false);
	}

	private boolean calendarHas(String key, EventCreation.Reference reference) {
		try {
			return creation.eventId(key, reference).isPresent();
		}
		catch (ProgramException unreadable) {
			// Luma cannot say now; a page that links there is still what was asked.
			return false;
		}
	}

	private ChangedEvent state(Actor actor, UUID programId, List<String> changed, @Nullable OnLuma luma,
			boolean pending) {
		AdminProgramResponse program = administration.get(actor, programId);
		return new ChangedEvent(program.id(), program.slug(), program.name(), program.lumaEventId(), program.status(),
				changed, program.publishIssues(), luma, pending);
	}

}
