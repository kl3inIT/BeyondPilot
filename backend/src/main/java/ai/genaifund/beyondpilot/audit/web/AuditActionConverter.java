package ai.genaifund.beyondpilot.audit.web;

import ai.genaifund.beyondpilot.audit.AuditAction;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/** Reads an action from a request by its stored name, {@code account.disable}, as the API publishes it. */
@Component
class AuditActionConverter implements Converter<String, AuditAction> {

	@Override
	public AuditAction convert(String value) {
		return AuditAction.of(value);
	}

}
