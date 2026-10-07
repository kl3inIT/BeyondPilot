package ai.genaifund.beyondpilot.mcp.server;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import ai.genaifund.beyondpilot.identity.McpCallers;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.search.Found;
import ai.genaifund.beyondpilot.search.SearchService;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import io.modelcontextprotocol.server.McpStatelessServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import io.modelcontextprotocol.spec.McpSchema.ToolAnnotations;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * The tools of {@code /mcp}: {@code search} and {@code fetch} over the solutions and programs BeyondPilot lists, in the
 * shapes ChatGPT's deep research expects (a JSON text of {@code results} with {@code id}, {@code title} and
 * {@code url}; a JSON text of {@code id}, {@code title}, {@code text}, {@code url} and {@code metadata}). They read
 * through the same services as the public site, so they see what a visitor sees and nothing more.
 */
@Component
class PublicTools {

	/** What the user server shows, as the consent page says: listed solutions and published programs. */
	private static final List<String> KINDS = List.of("solution", "program");

	/** The longest query search accepts. */
	private static final int MAX_QUERY = 100;

	private static final ToolAnnotations READ_ONLY = ToolAnnotations.builder()
		.readOnlyHint(true)
		.destructiveHint(false)
		.idempotentHint(true)
		.openWorldHint(false)
		.build();

	private final SearchService search;

	private final SolutionDirectory solutions;

	private final ProgramService programs;

	private final McpCallers callers;

	private final JsonMapper json;

	PublicTools(SearchService search, SolutionDirectory solutions, ProgramService programs, McpCallers callers,
			JsonMapper json) {
		this.search = search;
		this.solutions = solutions;
		this.programs = programs;
		this.callers = callers;
		this.json = json;
	}

	SyncToolSpecification search() {
		Tool tool = Tool.builder("search", schema("query", "What to look for, in words."))
			.title("Search BeyondPilot")
			.description("Search the AI solutions and the programs listed on BeyondPilot, GenAI Fund's network for "
					+ "enterprises and AI builders. Returns results with an id to read in full with fetch.")
			.annotations(READ_ONLY)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			String query = string(request.arguments(), "query");
			if (query == null || query.isBlank()) {
				return error("Give a query to search for.");
			}
			String trimmed = query.strip();
			List<Map<String, String>> results = new ArrayList<>();
			for (Found found : search.find(trimmed.length() > MAX_QUERY ? trimmed.substring(0, MAX_QUERY) : trimmed,
					KINDS)) {
				results.add(Map.of("id", found.kind() + ":" + found.slug(), "title", found.title(), "url",
						url(found.kind(), found.slug())));
			}
			return text(Map.of("results", results));
		});
	}

	SyncToolSpecification fetch() {
		Tool tool = Tool.builder("fetch", schema("id", "An id search returned."))
			.title("Read a BeyondPilot listing")
			.description("Read a solution or a program found with search, by its id.")
			.annotations(READ_ONLY)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			String id = string(request.arguments(), "id");
			int colon = id == null ? -1 : id.indexOf(':');
			if (colon < 1) {
				return error("Use an id search returned.");
			}
			String kind = id.substring(0, colon);
			String slug = id.substring(colon + 1);
			Optional<Map<String, Object>> document = switch (kind) {
				case "solution" -> solution(id, slug);
				case "program" -> program(id, slug);
				default -> Optional.empty();
			};
			return document.map(this::text).orElseGet(() -> error("Nothing listed on BeyondPilot has this id."));
		});
	}

	private Optional<Map<String, Object>> solution(String id, String slug) {
		return solutions.listed(slug).map(solution -> {
			StringBuilder text = new StringBuilder();
			line(text, null, solution.name() + " by " + solution.organizationName());
			line(text, null, solution.summary());
			line(text, "Problems it solves", solution.problemsSolved());
			line(text, "Value", solution.valueProposition());
			line(text, "Maturity", solution.maturity());
			line(text, "Traction", solution.traction());
			line(text, "Best customer", solution.bestCustomerProfile());
			line(text, "Industries", String.join(", ", solution.industries()));
			line(text, "Focus", String.join(", ", solution.focusAreas()));
			line(text, "Built with", String.join(", ", solution.builtWith()));
			line(text, "Deployment", String.join(", ", solution.deployment()));
			line(text, "Country", solution.country());
			line(text, "Customer deployments GenAI Fund approved", solution.customerDeployments());
			Map<String, Object> metadata = new LinkedHashMap<>();
			metadata.put("kind", "solution");
			metadata.put("organization", solution.organizationName());
			if (solution.country() != null) {
				metadata.put("country", solution.country());
			}
			metadata.put("industries", solution.industries());
			return document(id, solution.name(), text, url("solution", slug), metadata);
		});
	}

	private Optional<Map<String, Object>> program(String id, String slug) {
		return programs.published(slug).map(program -> {
			StringBuilder text = new StringBuilder();
			line(text, null, program.name());
			line(text, "Partner", program.partnerName());
			line(text, null, program.summary());
			line(text, null, program.about());
			if (program.startsOn() != null && program.endsOn() != null) {
				line(text, "Runs", program.startsOn() + " to " + program.endsOn());
			}
			if (program.applicationsOpenAt() != null && program.applicationsCloseAt() != null) {
				line(text, "Applications", "open " + program.applicationsOpenAt() + ", close "
						+ program.applicationsCloseAt());
			}
			Map<String, Object> metadata = new LinkedHashMap<>();
			metadata.put("kind", "program");
			metadata.put("type", program.type());
			String url = program.externalUrl() != null ? program.externalUrl() : url("program", slug);
			return document(id, program.name(), text, url, metadata);
		});
	}

	/** The input of a tool that takes one required string. */
	private static Map<String, Object> schema(String name, String description) {
		return Map.of("type", "object", "properties",
				Map.of(name, Map.of("type", "string", "description", description)), "required", List.of(name),
				"additionalProperties", false);
	}

	private static Map<String, Object> document(String id, String title, StringBuilder text, String url,
			Map<String, Object> metadata) {
		Map<String, Object> document = new LinkedHashMap<>();
		document.put("id", id);
		document.put("title", title);
		document.put("text", text.toString().strip());
		document.put("url", url);
		document.put("metadata", metadata);
		return document;
	}

	private static void line(StringBuilder text, @Nullable String label, @Nullable Object value) {
		if (value == null || value.toString().isBlank()) {
			return;
		}
		text.append(label == null ? "" : label + ": ").append(value).append("\n\n");
	}

	private String url(String kind, String slug) {
		return callers.site() + (kind.equals("solution") ? "/solutions/" : "/programs/") + slug;
	}

	private CallToolResult text(Object value) {
		return CallToolResult.builder().addTextContent(json.writeValueAsString(value)).isError(false).build();
	}

	private static CallToolResult error(String message) {
		return CallToolResult.builder().addTextContent(message).isError(true).build();
	}

	private static @Nullable String string(@Nullable Map<String, Object> arguments, String name) {
		Object value = arguments == null ? null : arguments.get(name);
		return value instanceof String text ? text : null;
	}

}
