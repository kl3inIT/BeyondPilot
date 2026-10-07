package ai.genaifund.beyondpilot.identity;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.dto.AppHostsResponse;
import ai.genaifund.beyondpilot.identity.persistence.AppHostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which AI apps may connect to the MCP servers, as operators set it in Admin › AI › MCP › Setup (BEY-78): the hosts
 * whose apps BeyondPilot has reviewed, which connect without a Not reviewed label, and whether apps of any other host
 * may connect at all. Only an operator reads or changes them, and every change is audited.
 */
@Service
public class AppHostAdministration {

	private static final String SETTING = "mcp_settings";

	/** A host name: labels of letters, digits and hyphens, at least two of them. */
	private static final Pattern HOST = Pattern
		.compile("^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$");

	private final AppHostRepository hosts;

	private final IdentityService identity;

	private final AuditTrail audit;

	AppHostAdministration(AppHostRepository hosts, IdentityService identity, AuditTrail audit) {
		this.hosts = hosts;
		this.identity = identity;
		this.audit = audit;
	}

	/** The reviewed hosts, with the apps of each that have signed in, and whether others may connect. */
	@Transactional(readOnly = true)
	public AppHostsResponse hosts(Actor actor) {
		identity.requireOperator(actor);
		return new AppHostsResponse(hosts.allowOtherHosts(), hosts.hosts()
			.stream()
			.map(host -> new AppHostsResponse.Host(host.host(), host.apps()))
			.toList());
	}

	/**
	 * Marks a host's apps as reviewed; adding one already there changes nothing.
	 * @throws IdentityException {@link IdentityErrorCode#APP_HOST_INVALID} when it is not a host name
	 */
	@Transactional
	public void add(Actor actor, String host) {
		Operator operator = identity.requireOperator(actor);
		String name = host.strip().toLowerCase(Locale.ROOT);
		if (!HOST.matcher(name).matches()) {
			throw new IdentityException(IdentityErrorCode.APP_HOST_INVALID, "Not a host name");
		}
		if (hosts.add(name)) {
			record(AuditAction.MCP_HOST_ADD, operator, name, Map.of());
		}
	}

	/**
	 * Takes a host off the list: its apps connect labelled Not reviewed, or not at all when others may not.
	 * @throws IdentityException {@link IdentityErrorCode#APP_HOST_NOT_FOUND} when it is not in the list
	 */
	@Transactional
	public void remove(Actor actor, String host) {
		Operator operator = identity.requireOperator(actor);
		String name = host.strip().toLowerCase(Locale.ROOT);
		if (!hosts.remove(name)) {
			throw new IdentityException(IdentityErrorCode.APP_HOST_NOT_FOUND, "No such reviewed host");
		}
		record(AuditAction.MCP_HOST_REMOVE, operator, name, Map.of());
	}

	/** Lets apps of hosts not reviewed connect, labelled Not reviewed, or stops them; a repeat records nothing. */
	@Transactional
	public void allowOtherHosts(Actor actor, boolean allow) {
		Operator operator = identity.requireOperator(actor);
		if (hosts.allowOtherHosts() == allow) {
			return;
		}
		hosts.allowOtherHosts(allow);
		record(allow ? AuditAction.MCP_OTHER_HOSTS_ALLOW : AuditAction.MCP_OTHER_HOSTS_REFUSE, operator,
				"Apps from other hosts", Map.of());
	}

	private void record(AuditAction action, Operator operator, String label, Map<String, String> details) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(SETTING, label, label), details));
	}

}
