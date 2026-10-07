package ai.genaifund.beyondpilot.mcp;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.identity.AccountAdministration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AppConnections;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.mcp.dto.McpCallListRequest;
import ai.genaifund.beyondpilot.mcp.dto.McpCallListResponse;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository.Filter;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository.LoggedCall;
import ai.genaifund.beyondpilot.mcp.server.McpSwitches;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin › AI › MCP › Activity (BEY-78): the calls AI apps made, newest first, by whom, through which app, to which
 * tool, and how each ended. What was asked is never kept, so never shown. Only an operator reads it.
 */
@Service
public class McpActivity {

	private static final int PAGE_SIZE = 50;

	private final McpCallRepository calls;

	private final IdentityService identity;

	private final AccountAdministration accounts;

	private final AppConnections apps;

	private final McpSwitches switches;

	McpActivity(McpCallRepository calls, IdentityService identity, AccountAdministration accounts,
			AppConnections apps, McpSwitches switches) {
		this.calls = calls;
		this.identity = identity;
		this.accounts = accounts;
		this.apps = apps;
		this.switches = switches;
	}

	@Transactional(readOnly = true)
	public McpCallListResponse calls(Actor actor, McpCallListRequest request) {
		identity.requireOperator(actor);
		String text = request.q() == null ? "" : request.q().strip();
		Collection<UUID> people = text.isEmpty() ? null : accounts.accountsMatching(text);
		Filter filter = new Filter(request.from(), request.app(), request.tool(), request.outcome(), people);
		int page = request.page() == null ? 1 : request.page();
		List<LoggedCall> found = calls.page(filter, PAGE_SIZE, (long) (page - 1) * PAGE_SIZE);
		List<String> callers = calls.clientsSince(request.from());

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
					call.durationMs());
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
		return new McpCallListResponse(items, page, PAGE_SIZE, calls.count(filter), appOptions, tools);
	}

}
