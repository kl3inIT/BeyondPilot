package ai.genaifund.beyondpilot.mcp.server;

import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.APPLICANTS_DATA;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.READ_ONLY;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.actor;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.error;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.fields;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.string;
import static ai.genaifund.beyondpilot.mcp.server.OperatorTools.uuid;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.BusinessException;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.McpCallers;
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
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * The operators' server's tools for programs (BEY-222): {@code list_programs}, every program in any status, and
 * {@code get_program}, one program as its admin pages hold it with how its applications are reviewed. Each calls the
 * service the admin page calls, with the caller as the actor, so the operator role is checked again there. Neither
 * changes anything.
 */
@Component
class ProgramTools {

	private final ProgramService programs;

	private final ProgramAdministration administration;

	private final ReviewService reviews;

	private final OutcomeService outcomes;

	private final McpCallers callers;

	private final JsonMapper json;

	ProgramTools(ProgramService programs, ProgramAdministration administration, ReviewService reviews,
			OutcomeService outcomes, McpCallers callers, JsonMapper json) {
		this.programs = programs;
		this.administration = administration;
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
