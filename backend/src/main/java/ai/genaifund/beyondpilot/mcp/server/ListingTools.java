package ai.genaifund.beyondpilot.mcp.server;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.identity.McpCallers;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.program.IndexedProgram;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.search.Found;
import ai.genaifund.beyondpilot.search.SearchService;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.talent.IndexedTalent;
import ai.genaifund.beyondpilot.talent.TalentDirectory;
import ai.genaifund.beyondpilot.usecase.IndexedUseCase;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import io.modelcontextprotocol.server.McpStatelessServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import io.modelcontextprotocol.spec.McpSchema.ToolAnnotations;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code search} and {@code fetch}, in the shapes ChatGPT's deep research expects (a JSON text of {@code results} with
 * {@code id}, {@code title} and {@code url}; a JSON text of {@code id}, {@code title}, {@code text}, {@code url} and
 * {@code metadata}), for each server. They read through the owning modules' published services, so each server sees
 * what its callers may see on the site:
 * <ul>
 * <li>{@code /mcp}: listed solutions and published programs, what a visitor finds;</li>
 * <li>{@code /mcp/operator}: also solutions their owners left unlisted, listed talent, use cases and approved
 * companies. Applications are read through a tool of their own, later.</li>
 * </ul>
 */
@Component
class ListingTools {

	private static final List<String> USER_KINDS = List.of("solution", "program");

	private static final List<String> OPERATOR_KINDS = List.of("solution", "program", "talent", "use_case");

	/** The longest query search accepts. */
	private static final int MAX_QUERY = 100;

	/** How many companies a search adds, found by name. */
	private static final int COMPANIES = 10;

	private static final ToolAnnotations READ_ONLY = ToolAnnotations.builder()
		.readOnlyHint(true)
		.destructiveHint(false)
		.idempotentHint(true)
		.openWorldHint(false)
		.build();

	private final SearchService search;

	private final SolutionDirectory solutions;

	private final ProgramService programs;

	private final TalentDirectory talent;

	private final UseCaseDirectory useCases;

	private final OrganizationDirectory organizations;

	private final McpCallers callers;

	private final JsonMapper json;

	ListingTools(SearchService search, SolutionDirectory solutions, ProgramService programs, TalentDirectory talent,
			UseCaseDirectory useCases, OrganizationDirectory organizations, McpCallers callers, JsonMapper json) {
		this.search = search;
		this.solutions = solutions;
		this.programs = programs;
		this.talent = talent;
		this.useCases = useCases;
		this.organizations = organizations;
		this.callers = callers;
		this.json = json;
	}

	SyncToolSpecification search(McpAudience server) {
		boolean operator = server == McpAudience.OPERATOR;
		Tool tool = Tool.builder("search", schema("query", "What to look for, in words."))
			.title("Search BeyondPilot")
			.description(operator
					? "Search BeyondPilot as a GenAI Fund operator: AI solutions, listed or not, programs, AI talent, "
							+ "use cases and companies. Returns results with an id to read in full with fetch."
					: "Search the AI solutions and the programs listed on BeyondPilot, GenAI Fund's network for "
							+ "enterprises and AI builders. Returns results with an id to read in full with fetch.")
			.annotations(READ_ONLY)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			String query = string(request.arguments(), "query");
			if (query == null || query.isBlank()) {
				return error("Give a query to search for.");
			}
			String trimmed = query.strip();
			String words = trimmed.length() > MAX_QUERY ? trimmed.substring(0, MAX_QUERY) : trimmed;
			List<Map<String, String>> results = new ArrayList<>();
			List<Found> found = operator ? search.findForOperators(words, OPERATOR_KINDS)
					: search.find(words, USER_KINDS);
			for (Found item : found) {
				results.add(result(item.kind() + ":" + item.slug(), item.title(), url(item.kind(), item.slug())));
			}
			if (operator) {
				for (OrganizationName company : organizations.approvedOrganizations(words, COMPANIES)) {
					results.add(result("organization:" + company.slug(), company.name(),
							url("organization", company.slug())));
				}
			}
			return text(Map.of("results", results));
		});
	}

	SyncToolSpecification fetch(McpAudience server) {
		boolean operator = server == McpAudience.OPERATOR;
		Tool tool = Tool.builder("fetch", schema("id", "An id search returned."))
			.title("Read a BeyondPilot listing")
			.description(operator ? "Read in full a solution, program, person, use case or company found with search, "
					+ "by its id." : "Read a solution or a program found with search, by its id.")
			.annotations(READ_ONLY)
			.build();
		return new SyncToolSpecification(tool, (context, request) -> {
			String id = string(request.arguments(), "id");
			int colon = id == null ? -1 : id.indexOf(':');
			if (colon < 1) {
				return error("Use an id search returned.");
			}
			String kind = id.substring(0, colon);
			String key = id.substring(colon + 1);
			Optional<Map<String, Object>> document = switch (kind) {
				case "solution" -> (operator ? solutions.approved(key) : solutions.listed(key))
					.map(solution -> solution(id, solution));
				case "program" -> programs.published(key).map(program -> program(id, program));
				case "talent" -> operator ? talent.listed(key).map(person -> person(id, person)) : Optional.empty();
				case "use_case" -> operator ? uuid(key).flatMap(useCases::indexed).map(useCase -> useCase(id, useCase))
						: Optional.empty();
				case "organization" -> operator ? company(id, key) : Optional.empty();
				default -> Optional.empty();
			};
			return document.map(this::text).orElseGet(() -> error("Nothing on BeyondPilot has this id for you."));
		});
	}

	private Map<String, Object> solution(String id, IndexedSolution solution) {
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
		metadata.put("listed", solution.listed());
		return document(id, solution.name(), text, url("solution", solution.slug()), metadata);
	}

	private Map<String, Object> program(String id, IndexedProgram program) {
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
		String url = program.externalUrl() != null ? program.externalUrl() : url("program", program.slug());
		return document(id, program.name(), text, url, metadata);
	}

	private Map<String, Object> person(String id, IndexedTalent person) {
		StringBuilder text = new StringBuilder();
		line(text, null, person.name());
		line(text, null, person.headline());
		line(text, null, person.bio());
		line(text, "Roles", String.join(", ", person.roles()));
		line(text, "Skills", String.join(", ", person.skills()));
		line(text, "Industries", String.join(", ", person.industries()));
		line(text, "Works at", person.worksAt());
		line(text, "Based in", person.city() == null ? person.country() : person.city() + ", " + person.country());
		Map<String, Object> metadata = new LinkedHashMap<>();
		metadata.put("kind", "talent");
		metadata.put("roles", person.roles());
		if (person.country() != null) {
			metadata.put("country", person.country());
		}
		return document(id, person.name(), text, url("talent", person.slug()), metadata);
	}

	private Map<String, Object> useCase(String id, IndexedUseCase useCase) {
		StringBuilder text = new StringBuilder();
		line(text, null, useCase.title());
		line(text, "Organization", useCase.organizationName());
		line(text, "Industry", useCase.industry());
		line(text, "Expected outcomes", useCase.expectedOutcomes());
		line(text, "Technologies", String.join(", ", useCase.technologies()));
		line(text, "Budget", budget(useCase));
		line(text, "Closes", useCase.closesAt());
		Map<String, Object> metadata = new LinkedHashMap<>();
		metadata.put("kind", "use_case");
		if (useCase.industry() != null) {
			metadata.put("industry", useCase.industry());
		}
		return document(id, useCase.title(), text, url("use_case", useCase.id().toString()), metadata);
	}

	private Optional<Map<String, Object>> company(String id, String slug) {
		return organizations.approvedAt(slug).flatMap(name -> organizations.profile(name.id())).map(profile -> {
			StringBuilder text = new StringBuilder();
			line(text, null, profile.name());
			line(text, "Type", profile.type());
			line(text, "Country", profile.country());
			line(text, "Team size", profile.teamSize());
			line(text, "Website", profile.website());
			Map<String, Object> metadata = new LinkedHashMap<>();
			metadata.put("kind", "organization");
			if (profile.country() != null) {
				metadata.put("country", profile.country());
			}
			return document(id, profile.name(), text, url("organization", profile.slug()), metadata);
		});
	}

	private static @Nullable String budget(IndexedUseCase useCase) {
		if (useCase.budgetToBeDetermined()) {
			return "to be determined";
		}
		if (useCase.budgetMin() == null && useCase.budgetMax() == null) {
			return null;
		}
		String range = useCase.budgetMin() != null && useCase.budgetMax() != null
				? useCase.budgetMin() + " to " + useCase.budgetMax()
				: String.valueOf(useCase.budgetMin() != null ? useCase.budgetMin() : useCase.budgetMax());
		return useCase.currency() + " " + range;
	}

	/** The input of a tool that takes one required string. */
	private static Map<String, Object> schema(String name, String description) {
		return Map.of("type", "object", "properties",
				Map.of(name, Map.of("type", "string", "description", description)), "required", List.of(name),
				"additionalProperties", false);
	}

	private static Map<String, String> result(String id, String title, String url) {
		return Map.of("id", id, "title", title, "url", url);
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

	/** The page of an item: the public one, or the admin one for a use case, which has none. */
	private String url(String kind, String key) {
		String path = switch (kind) {
			case "solution" -> "/solutions/";
			case "program" -> "/programs/";
			case "talent" -> "/talent/";
			case "organization" -> "/organizations/";
			default -> "/admin/use-cases/";
		};
		return callers.site() + path + key;
	}

	private static Optional<UUID> uuid(String value) {
		try {
			return Optional.of(UUID.fromString(value));
		}
		catch (IllegalArgumentException notAnId) {
			return Optional.empty();
		}
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
