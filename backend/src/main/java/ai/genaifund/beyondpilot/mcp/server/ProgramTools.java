package ai.genaifund.beyondpilot.mcp.server;

import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.APPLICANTS_DATA;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.READ_ONLY;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.actor;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.error;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.fields;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.string;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.uuid;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import java.util.UUID;

import jakarta.validation.ConstraintViolationException;

import ai.genaifund.beyondpilot.BusinessException;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.McpCallers;
import ai.genaifund.beyondpilot.program.EventCreation;
import ai.genaifund.beyondpilot.program.ProgramAdministration;
import ai.genaifund.beyondpilot.program.ProgramName;
import ai.genaifund.beyondpilot.program.ProgramOverview;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.program.ProgramSettings;
import ai.genaifund.beyondpilot.proposal.ApplicationCounts;
import ai.genaifund.beyondpilot.proposal.OutcomeService;
import ai.genaifund.beyondpilot.proposal.ProgramReview;
import ai.genaifund.beyondpilot.proposal.ProposalErrorCode;
import ai.genaifund.beyondpilot.proposal.ReviewService;
import io.modelcontextprotocol.server.McpStatelessServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import io.modelcontextprotocol.spec.McpSchema.ToolAnnotations;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * The operators' server's tools for programs (BEY-222): {@code list_programs}, every program in any status, and
 * {@code get_program}, one program as its admin pages hold it with how its applications are reviewed, which change
 * nothing; and {@code create_event} (BEY-250), an event on the Luma calendar with its page here, or here alone, as a
 * draft. Each calls the service the admin page calls, with the caller as the actor, so the operator role is checked
 * again there.
 */
@Component
class ProgramTools {

	/** Makes a draft nobody sees or is told of; on Luma, a private event of the real calendar, outside BeyondPilot. */
	private static final ToolAnnotations CREATES_DRAFT = ToolAnnotations.builder()
		.readOnlyHint(false)
		.destructiveHint(false)
		.idempotentHint(false)
		.openWorldHint(true)
		.build();

	private final ProgramService programs;

	private final ProgramAdministration administration;

	private final EventCreation creation;

	private final ReviewService reviews;

	private final OutcomeService outcomes;

	private final McpCallers callers;

	private final JsonMapper json;

	ProgramTools(ProgramService programs, ProgramAdministration administration, EventCreation creation,
			ReviewService reviews, OutcomeService outcomes, McpCallers callers, JsonMapper json) {
		this.programs = programs;
		this.administration = administration;
		this.creation = creation;
		this.reviews = reviews;
		this.outcomes = outcomes;
		this.callers = callers;
		this.json = json;
	}

	SyncToolSpecification listPrograms() {
		Map<String, Object> schema = Map.of("type", "object", "properties", Map.of(), "additionalProperties", false);
		Tool tool = Tool.builder("list_programs", schema)
			.title("List programs")
			.description("Admin view of every GenAI Fund program, drafts included, where search finds only the "
					+ "published ones; the ones that need attention first. Each with its type, status (draft or "
					+ "published), phase (upcoming, open, running or done), dates, application window and how many "
					+ "applications it has, submitted, in draft and withdrawn. Read one with get_program; its "
					+ "applications with list_applications.")
			.annotations(READ_ONLY)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			Actor actor = actor(context.get(CallLog.CALLER));
			List<ProgramOverview> found;
			Map<UUID, ApplicationCounts> counts;
			try {
				found = administration.overviews(actor);
				counts = reviews.countsOf(actor);
			}
			catch (BusinessException refused) {
				return error(refused.safeMessage());
			}
			List<Map<String, Object>> items = new ArrayList<>();
			for (ProgramOverview program : found) {
				Map<String, Object> item = overview(program);
				if (program.applications() != null) {
					ApplicationCounts count = counts.getOrDefault(program.id(), ApplicationCounts.NONE);
					item.put("applicationCounts", fields("submitted", count.submitted(), "drafts", count.drafts(),
							"withdrawn", count.withdrawn()));
				}
				item.put("url", callers.site() + "/admin/programs/" + program.id());
				items.add(item);
			}
			return text(fields("total", items.size(), "programs", items));
		});
	}

	SyncToolSpecification getProgram() {
		Map<String, Object> schema = Map.of("type", "object", "properties",
				Map.of("program", Map.of("type", "string", "description",
						"The program: an id list_programs or search returned, such as program:insurance-ai-challenge, "
								+ "its slug or its programId."),
						"detail", Map.of("type", "boolean", "description",
								"Also the page text, each question in full and the judges' emails; false by default.")),
				"required", List.of("program"), "additionalProperties", false);
		Tool tool = Tool.builder("get_program", schema)
			.title("Read a program")
			.description("Admin view of one GenAI Fund program in any status, drafts included, where fetch reads "
					+ "only a published one's public page: its settings, application window (opens, closes, shortlist "
					+ "size, outcomes due), key dates, events and the questions its form asks. For a program that "
					+ "takes applications, also its review: the criteria with their points, the judges with their "
					+ "status and how many they assessed, and the outcomes, released or not, with the applications "
					+ "shortlisted, not selected and undecided. Reading it releases nothing. detail adds the page "
					+ "text, each question's help, options and length, and the judges' emails." + APPLICANTS_DATA)
			.annotations(READ_ONLY)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			UUID id = programId(string(request.arguments(), "program"));
			if (id == null) {
				return error("No program has this id. Find it with list_programs.");
			}
			boolean detail = request.arguments() != null && Boolean.TRUE.equals(request.arguments().get("detail"));
			Actor actor = actor(context.get(CallLog.CALLER));
			ProgramSettings settings;
			ProgramReview review;
			try {
				settings = administration.settingsOf(actor, id);
				review = reviewOf(actor, id);
			}
			catch (BusinessException refused) {
				return error(refused.safeMessage());
			}
			ProgramOverview program = settings.program();
			String admin = "/admin/programs/" + program.id();
			CallLog.read("program", program.id(), program.name(), admin);
			Map<String, Object> result = overview(program);
			result.putAll(fields("summary", settings.summary(), "about", detail ? settings.about() : null,
					"pageKind", settings.pageKind(), "externalUrl", settings.externalUrl(), "lumaEventId",
					settings.lumaEventId(), "publishIssues", settings.publishIssues(), "createdAt",
					settings.createdAt().toString()));
			result.put("keyDates", settings.keyDates()
				.stream()
				.map(date -> fields("title", date.title(), "startsAt", date.startsAt().toString(), "endsAt",
						iso(date.endsAt()), "allDay", date.allDay(), "note", date.note()))
				.toList());
			result.put("events", settings.events()
				.stream()
				.map(event -> fields("title", event.title(), "startsAt", event.startsAt().toString(), "endsAt",
						iso(event.endsAt()), "online", event.online(), "city", event.city(), "country",
						event.country(), "registrationUrl", event.registrationUrl()))
				.toList());
			result.put("questions", settings.questions()
				.stream()
				.map(question -> detail ? fields("kind", question.kind(), "label", question.label(), "help",
						question.help(), "required", question.required(), "options",
						question.options().isEmpty() ? null : question.options(), "maxLength", question.maxLength())
						: fields("kind", question.kind(), "label", question.label(), "required", question.required()))
				.toList());
			result.put("questionsFixed", settings.questionsFixed());
			if (review != null) {
				result.put("review", review(review, admin, detail));
			}
			result.put("url", callers.site() + admin);
			return text(result);
		});
	}

	SyncToolSpecification createEvent() {
		Map<String, Object> question = new LinkedHashMap<>();
		question.put("label", Map.of("type", "string", "maxLength", 200, "description", "What the form asks."));
		question.put("type", Map.of("type", "string", "enum", List.copyOf(new TreeSet<>(EventCreation.questionTypes())),
				"description", "text for a line, long_text for a paragraph, select or multi_select with options, url, "
						+ "linkedin, agree for a box to tick, company for the company and the job title."));
		question.put("required", Map.of("type", "boolean"));
		question.put("options", Map.of("type", "array", "maxItems", 50, "items",
				Map.of("type", "string", "maxLength", 200), "description", "For select and multi_select: two or more."));
		Map<String, Object> properties = new LinkedHashMap<>();
		properties.put("on_luma", Map.of("type", "boolean", "description", "True, the default, to create it on GenAI "
				+ "Fund's Luma calendar with its page and registration form on BeyondPilot; false for an event GenAI "
				+ "Fund does not run on Luma, such as a partner's, which gets a page on BeyondPilot alone."));
		properties.put("name", Map.of("type", "string", "maxLength", 120, "description", "The event's name."));
		properties.put("starts_at", Map.of("type", "string", "description",
				"When it starts, as an ISO date-time with its offset, such as 2026-10-30T18:30:00+07:00."));
		properties.put("ends_at", Map.of("type", "string", "description", "When it ends, the same way; after starts_at."));
		properties.put("timezone", Map.of("type", "string", "description",
				"The IANA zone of the place, such as Asia/Ho_Chi_Minh or Asia/Singapore."));
		properties.put("venue", Map.of("type", "string", "maxLength", 300, "description",
				"The address of an event in person, as written. Leave it out for one online."));
		properties.put("meeting_url", Map.of("type", "string", "maxLength", 2000, "description",
				"The join link of an event online, https://..."));
		properties.put("city", Map.of("type", "string", "maxLength", 80, "description",
				"The city, for an event on BeyondPilot alone; Luma works it out itself."));
		properties.put("country", Map.of("type", "string", "maxLength", 80, "description",
				"The country, for an event on BeyondPilot alone."));
		properties.put("description", Map.of("type", "string", "maxLength", 20000, "description",
				"What the event is, for whom and what happens, in Markdown."));
		properties.put("summary", Map.of("type", "string", "maxLength", 300, "description", "One or two sentences for "
				+ "the card, for an event on BeyondPilot alone; on Luma it is taken from the description."));
		properties.put("require_approval", Map.of("type", "boolean", "description",
				"On Luma: true when GenAI Fund approves each guest; false confirms them at once."));
		properties.put("capacity", Map.of("type", "integer", "minimum", 1, "maximum", 100000, "description",
				"On Luma: the seats; left out for no limit."));
		properties.put("waitlist", Map.of("type", "boolean", "description",
				"On Luma: true to put people on a waitlist once the seats are taken."));
		properties.put("hide_venue_until_approved", Map.of("type", "boolean", "description",
				"On Luma: true to show the address only to guests who are in."));
		properties.put("questions", Map.of("type", "array", "maxItems", 30, "description", "On Luma: what the "
				+ "registration form asks besides the name and email, which every form asks.", "items",
				Map.of("type", "object", "properties", question, "required", List.of("label", "type", "required"),
						"additionalProperties", false)));
		properties.put("registration_url", Map.of("type", "string", "maxLength", 2000, "description",
				"For an event on BeyondPilot alone: where people register, https://...; its page then links there."));
		Map<String, Object> schema = Map.of("type", "object", "properties", properties, "required",
				List.of("name", "starts_at", "timezone"), "additionalProperties", false);
		Tool tool = Tool.builder("create_event", schema)
			.title("Create an event")
			.description("Create an event as a draft that nobody sees and nobody is told of. By default it is created "
					+ "on GenAI Fund's Luma calendar as a private, free event, and its page on BeyondPilot is made at "
					+ "once, with a registration form built from the questions given: people register there and "
					+ "reach Luma's guest list. With on_luma false it is a page on BeyondPilot alone, with no "
					+ "registration form, linking to registration_url when given. Use it only for an event the "
					+ "operator asked for in this conversation, with what they gave: leave out what they did not say "
					+ "rather than invent it, and ask for the date, time and zone when they are not clear. A paid "
					+ "event, a cover, or a Zoom link made by Luma are set on Luma. It is not undone here: an operator "
					+ "deletes the draft in Admin › Programs, and the event on Luma. An operator publishes it: the "
					+ "program in Admin › Programs, and the event's visibility on Luma. The answer gives the admin "
					+ "page, the page on BeyondPilot and, for an event on Luma, its page there.")
			.annotations(CREATES_DRAFT)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			Map<String, Object> arguments = request.arguments() == null ? Map.of() : request.arguments();
			Actor actor = actor(context.get(CallLog.CALLER));
			boolean onLuma = !Boolean.FALSE.equals(arguments.get("on_luma"));
			EventCreation.CreatedEvent created;
			try {
				EventCreation.NewEvent event = newEvent(arguments);
				created = onLuma ? creation.onLuma(actor, event) : creation.here(actor, event);
			}
			catch (IllegalArgumentException wrong) {
				return error(Objects.requireNonNullElse(wrong.getMessage(), "An argument is not valid."));
			}
			catch (BusinessException refused) {
				return error(refused.safeMessage() + " (" + refused.code() + ").");
			}
			catch (ConstraintViolationException invalid) {
				return UseCaseTools.invalid(invalid);
			}
			Map<String, Object> result = fields("name", created.name(), "on", onLuma ? "luma" : "beyondpilot", "status",
					"draft", "lumaEventId", created.lumaEventId());
			UUID id = created.programId();
			if (id == null) {
				result.put("next", "The event is on Luma; its page on BeyondPilot follows at the next read of the "
						+ "calendar, within the hour.");
				return text(result);
			}
			String admin = "/admin/programs/" + id;
			CallLog.read("program", id, created.name(), admin);
			result.put("id", "program:" + created.slug());
			result.put("programId", id.toString());
			result.put("adminUrl", callers.site() + admin);
			result.put("pageUrl", callers.site() + "/programs/" + created.slug());
			if (onLuma) {
				try {
					String luma = administration.settingsOf(actor, id).externalUrl();
					if (luma != null) {
						result.put("lumaUrl", luma);
					}
				}
				catch (BusinessException gone) {
					// The draft was removed meanwhile; the other links say enough.
				}
			}
			result.put("next", onLuma
					? "Publish the program in Admin › Programs when it is ready, and make the event public on Luma."
					: "Add a cover and publish the program in Admin › Programs when it is ready.");
			return text(result);
		});
	}

	/** The event the arguments give. */
	private static EventCreation.NewEvent newEvent(Map<String, Object> arguments) {
		String name = blank(string(arguments, "name"));
		if (name == null) {
			throw new IllegalArgumentException("Give the event's name.");
		}
		ZoneId zone;
		try {
			zone = ZoneId.of(Objects.requireNonNullElse(string(arguments, "timezone"), ""));
		}
		catch (DateTimeException notOne) {
			throw new IllegalArgumentException("Give timezone as an IANA zone, such as Asia/Ho_Chi_Minh.");
		}
		Instant starts = moment(arguments, "starts_at");
		if (starts == null) {
			throw new IllegalArgumentException("Give starts_at, such as 2026-10-30T18:30:00+07:00.");
		}
		if (!starts.isAfter(Instant.now())) {
			throw new IllegalArgumentException("Give starts_at in the future.");
		}
		Instant ends = moment(arguments, "ends_at");
		if (ends != null && !ends.isAfter(starts)) {
			throw new IllegalArgumentException("Give ends_at after starts_at.");
		}
		String venue = blank(string(arguments, "venue"));
		String meeting = web(arguments, "meeting_url");
		if (venue != null && meeting != null) {
			throw new IllegalArgumentException("Give either venue or meeting_url, not both.");
		}
		Integer seats = arguments.get("capacity") instanceof Number number ? Integer.valueOf(number.intValue()) : null;
		if (seats != null && seats < 1) {
			throw new IllegalArgumentException("Give capacity from 1, or leave it out for no limit.");
		}
		return new EventCreation.NewEvent(name, starts, ends, zone, venue, blank(string(arguments, "city")),
				blank(string(arguments, "country")), meeting, blank(string(arguments, "description")),
				blank(string(arguments, "summary")), Boolean.TRUE.equals(arguments.get("require_approval")), seats,
				Boolean.TRUE.equals(arguments.get("waitlist")),
				Boolean.TRUE.equals(arguments.get("hide_venue_until_approved")), questions(arguments.get("questions")),
				web(arguments, "registration_url"));
	}

	private static List<EventCreation.Question> questions(@Nullable Object given) {
		if (given == null) {
			return List.of();
		}
		if (!(given instanceof List<?> list)) {
			throw new IllegalArgumentException("Give questions as a list.");
		}
		List<EventCreation.Question> questions = new ArrayList<>();
		for (Object item : list) {
			if (!(item instanceof Map<?, ?> question) || !(question.get("label") instanceof String label)
					|| label.isBlank() || !(question.get("type") instanceof String type)) {
				throw new IllegalArgumentException("Give each question a label and a type.");
			}
			List<String> options = question.get("options") instanceof List<?> named ? named.stream()
				.filter(String.class::isInstance)
				.map(String.class::cast)
				.map(String::strip)
				.filter(option -> !option.isEmpty())
				.distinct()
				.toList() : List.of();
			questions.add(new EventCreation.Question(label, type, Boolean.TRUE.equals(question.get("required")),
					options));
		}
		return questions;
	}

	/** An ISO date-time with its offset, or null when left out. */
	private static @Nullable Instant moment(Map<String, Object> arguments, String name) {
		String given = blank(string(arguments, name));
		if (given == null) {
			return null;
		}
		try {
			return OffsetDateTime.parse(given).toInstant();
		}
		catch (DateTimeParseException notOne) {
			throw new IllegalArgumentException(
					"Give " + name + " as an ISO date-time with its offset, such as 2026-10-30T18:30:00+07:00.");
		}
	}

	/** A web address, or null when left out. */
	private static @Nullable String web(Map<String, Object> arguments, String name) {
		String given = blank(string(arguments, name));
		if (given != null && !given.matches("https?://\\S+")) {
			throw new IllegalArgumentException("Give " + name + " as a web address, https://...");
		}
		return given;
	}

	private static @Nullable String blank(@Nullable String text) {
		return text == null || text.isBlank() ? null : text.strip();
	}

	/** The program's review, or null when it takes no applications. */
	private @Nullable ProgramReview reviewOf(Actor actor, UUID id) {
		try {
			return outcomes.reviewOf(actor, id);
		}
		catch (BusinessException refused) {
			if (refused.code().equals(ProposalErrorCode.REVIEW_PROGRAM_NOT_FOUND.code())) {
				return null;
			}
			throw refused;
		}
	}

	private Map<String, Object> review(ProgramReview review, String admin, boolean detail) {
		String applications = callers.site() + admin + "/applications/";
		Map<String, Object> result = fields("criteria", review.criteria()
			.stream()
			.map(criterion -> fields("name", criterion.name(), "description", criterion.description(), "maxPoints",
					criterion.maxPoints()))
			.toList(), "criteriaFixed", review.criteriaFixed());
		result.put("judges", review.judges()
			.stream()
			.map(judge -> fields("name", judge.name(), "email", detail || judge.name() == null ? judge.email() : null,
					"role", judge.role(), "status", judge.status(), "invitedAt", iso(judge.invitedAt()), "assessed",
					judge.assessed()))
			.toList());
		result.put("judgesUrl", callers.site() + admin + "/reviewers");
		result.put("submitted", review.shortlisted().size() + review.notSelected().size() + review.undecided().size());
		result.put("drafts", review.drafts());
		result.put("withdrawn", review.withdrawn());
		result.put("outcomes", fields("released", review.releasedAt() != null, "releasedAt", iso(review.releasedAt()),
				"readyToRelease", review.readyToRelease(), "shortlisted", outcomes(review.shortlisted(), applications),
				"notSelected", outcomes(review.notSelected(), applications), "undecided",
				outcomes(review.undecided(), applications), "url", callers.site() + admin + "/release"));
		return result;
	}

	private static List<Map<String, Object>> outcomes(List<ProgramReview.Outcome> outcomes, String applications) {
		return outcomes.stream()
			.map(outcome -> fields("id", outcome.id().toString(), "solution", outcome.solutionName(), "organization",
					outcome.organizationName(), "averageScore", outcome.averageScore(), "url",
					applications + outcome.id()))
			.toList();
	}

	/** What both program tools say of a program first. */
	private static Map<String, Object> overview(ProgramOverview program) {
		ProgramOverview.Window window = program.applications();
		return fields("id", "program:" + program.slug(), "programId", program.id().toString(), "name", program.name(),
				"type", program.type(), "partner", program.partnerName(), "status", program.status(), "phase",
				program.phase(), "startsOn", iso(program.startsOn()), "endsOn", iso(program.endsOn()), "featuredAt",
				iso(program.featuredAt()), "applications",
				window == null ? null
						: fields("opensAt", window.opensAt().toString(), "closesAt", window.closesAt().toString(),
								"shortlistSize", window.shortlistSize(), "outcomesDueOn", iso(window.outcomesDueOn()),
								"allowUpdatesUntilClose", window.allowUpdatesUntilClose()),
				"updatedAt", program.updatedAt().toString());
	}

	/** The program an argument names: {@code program:<slug>}, a slug or an identifier; null when none has it. */
	private @Nullable UUID programId(@Nullable String given) {
		if (given == null || given.isBlank()) {
			return null;
		}
		String named = given.strip();
		UUID id = uuid(named);
		if (id != null) {
			return id;
		}
		String slug = named.startsWith("program:") ? named.substring("program:".length()) : named;
		return programs.named(slug).map(ProgramName::id).orElse(null);
	}

	/** A date or a moment as ISO 8601, or null. */
	private static @Nullable String iso(@Nullable Object value) {
		return value == null ? null : value.toString();
	}

	private CallToolResult text(Object value) {
		return CallToolResult.builder().addTextContent(json.writeValueAsString(value)).isError(false).build();
	}

}
