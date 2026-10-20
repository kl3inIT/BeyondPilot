package ai.genaifund.beyondpilot.identity;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditLog;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The audit log downloaded as a spreadsheet. It lives here and not in {@code audit}, which cannot name the caller
 * (ADR 0004): a download takes operators' email out of BeyondPilot, so who downloaded it is recorded like any other
 * download.
 */
@Service
public class AuditLogDownload {

	private static final Logger LOG = LoggerFactory.getLogger(AuditLogDownload.class);

	private final IdentityService identity;

	private final AuditLog log;

	private final AuditTrail audit;

	AuditLogDownload(IdentityService identity, AuditLog log, AuditTrail audit) {
		this.identity = identity;
		this.log = log;
		this.audit = audit;
	}

	/**
	 * Every event the filters select, newest first, as the audit log narrows them.
	 * @throws IdentityException when the caller is not an operator
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, @Nullable Instant from, @Nullable AuditAction action, @Nullable String q,
			@Nullable List<AuditAction> actions, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		String text = q == null || q.isBlank() ? null : q.strip();
		SpreadsheetFile file = log.spreadsheet(from, action, text, actions, format, operator.label());
		audit.record(new AuditRecord(AuditAction.AUDIT_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("audit_log", "audit-log", "Audit log"),
				Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "identity.audit_log.exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Audit log exported");
		return file;
	}

}
