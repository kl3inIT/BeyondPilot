package ai.genaifund.beyondpilot.notification.template;

import ai.genaifund.beyondpilot.notification.persistence.EmailTemplateOverrideRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The wording in use for each kind: an operator's, or the default when nobody changed it. */
@Component
public class EmailTemplates {

	private final DefaultTemplates defaults;

	private final EmailTemplateOverrideRepository overrides;

	EmailTemplates(DefaultTemplates defaults, EmailTemplateOverrideRepository overrides) {
		this.defaults = defaults;
		this.overrides = overrides;
	}

	@Transactional(readOnly = true)
	public EmailTemplate current(EmailKind kind) {
		if (!kind.editable()) {
			return defaults.template(kind);
		}
		return overrides.findById(kind.value())
			.map(override -> new EmailTemplate(override.getSubject(), override.getBody()))
			.orElseGet(() -> defaults.template(kind));
	}

}
