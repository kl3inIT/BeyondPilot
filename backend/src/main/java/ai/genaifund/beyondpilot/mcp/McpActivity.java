package ai.genaifund.beyondpilot.mcp;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.AccountAdministration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AppConnections;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.mcp.dto.McpCallListRequest;
import ai.genaifund.beyondpilot.mcp.dto.McpCallListResponse;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository.Filter;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository.LoggedCall;
import ai.genaifund.beyondpilot.mcp.server.McpSwitches;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin › AI › MCP › Activity (BEY-78): the calls AI apps made, newest first, by whom, through which app, to which
 * tool, the record each read (BEY-222) and how each ended, with the counts of the period. What was asked is never
 * kept, so never shown. Only an operator reads it.
 */
@Service
public class McpActivity {

	private static final Logger LOG = LoggerFactory.getLogger(McpActivity.class);

	private static final int PAGE_SIZE = 50;

	private final McpCallRepository calls;

	private final IdentityService identity;

	private final AccountAdministration accounts;

	private final AppConnections apps;

	private final McpSwitches switches;

	private final AuditTrail audit;

	McpActivity(McpCallRepository calls, IdentityService identity, AccountAdministration accounts,
			AppConnections apps, McpSwitches switches, AuditTrail audit) {
		this.calls = calls;
		this.identity = identity;
		this.accounts = accounts;
		this.apps = apps;
		this.switches = switches;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public McpCallListResponse calls(Actor actor, McpCallListRequest request) {
		identity.requireOperator(actor);
		String text = request.q() == null ? "" : request.q().strip();
		Collection<UUID> people = text.isEmpty() ? null : accounts.accountsMatching(text);
		Filter filter = new Filter(request.from(), request.app(), request.tool(), request.outcome(), people);
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		List<LoggedCall> found = calls.page(filter, size, (long) (page - 1) * size);
		List<String> callers = calls.clientsSince(request.from());
		// The counts keep every outcome, so choosing one to list leaves them as they are.
		McpCallRepository.Counts counts = calls
			.count(new Filter(request.from(), request.app(), request.tool(), null, people));
		long total = request.outcome() == null ? counts.calls() : calls.count(filter).calls();

		Set<String> clientIds = new HashSet<>(callers);
		found.forEach(call -> clientIds.add(call.clientId()));
		Map<String, AppConnections.AppName> names = apps.appNames(clientIds);
		Map<UUID, Person> persons = identity.people(found.stream().map(LoggedCall::accountId).distinct().toList());

		List<McpCallListResponse.Item> items = found.stream().map(call -> {
			Person person = persons.get(call.accountId());
			AppConnections.AppName app = names.get(call.clientId());
			return new McpCallListResponse.Item(call.calledAt(), call.accountId(),
					person == null ? null : person.displayName(), person == null ? null : person.email(),
					call.clientId(), app.name(), app.host(), call.server(), call.tool(), call.outcome(),
					call.durationMs(), call.target() == null ? null
							: new McpCallListResponse.Target(call.target().kind(), call.target().id(),
									call.target().label(), call.target().path()));
		}).toList();
		List<McpCallListResponse.App> appOptions = callers.stream()
			.map(clientId -> new McpCallListResponse.App(clientId, names.get(clientId).name(),
					names.get(clientId).host()))
			.sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
			.toList();
		List<String> tools = Stream.of(McpAudience.OPERATOR, McpAudience.USER)
			.flatMap(server -> switches.tools(server).stream())
			.map(tool -> tool.tool().tool().name())
			.distinct()
			.toList();
		return new McpCallListResponse(items, page, size, total, appOptions, tools,
				new McpCallListResponse.Counts(counts.calls(), counts.refused(), counts.failed()));
	}

	/**
	 * The activity as a spreadsheet: every call the request selects, newest first, for GenAI Fund to work with outside
	 * BeyondPilot. It names people and their addresses, so the download is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, McpCallListRequest request, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		List<McpCallListResponse.Item> rows = Spreadsheet.everyPage(page -> calls(actor,
				new McpCallListRequest(request.from(), request.app(), request.tool(), request.outcome(), request.q(),
						page, Spreadsheet.PAGE_SIZE))
			.items());
		Spreadsheet<McpCallListResponse.Item> sheet = Spreadsheet.<McpCallListResponse.Item>of("MCP calls")
			.time("Called at", McpCallListResponse.Item::calledAt)
			.text("Person", McpCallListResponse.Item::personName)
			.email("Email", McpCallListResponse.Item::personEmail)
			.text("App", McpCallListResponse.Item::appName)
			.label("Server", McpCallListResponse.Item::server)
			.text("Tool", McpCallListResponse.Item::tool)
			.label("Outcome", McpCallListResponse.Item::outcome)
			.count("Duration (ms)", McpCallListResponse.Item::durationMs)
			.text("Record read", call -> call.target() == null ? null : call.target().label());
		SpreadsheetFile file = sheet.write(format, "mcp-calls", rows,
				Spreadsheet.About.of(operator.label(), Instant.now())
					.narrowedBy("Since", request.from())
					.narrowedBy("App", request.app())
					.narrowedBy("Tool", request.tool())
					.narrowedBy("Outcome", request.outcome())
					.narrowedBy("Search", request.q()));
		audit.record(new AuditRecord(AuditAction.MCP_CALLS_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("mcp_activity", "calls", "MCP activity"),
				Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "mcp.calls.exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("MCP activity exported");
		return file;
	}

}
