package ai.genaifund.beyondpilot.notification;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.notification.adapter.EmailDeliveryException.DeliveryFailure;
import ai.genaifund.beyondpilot.notification.delivery.EmailDelivery;
import ai.genaifund.beyondpilot.notification.dto.EmailDraftRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailPreviewResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTemplateListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTemplateResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTestResponse;
import ai.genaifund.beyondpilot.notification.dto.SaveEmailTemplateRequest;
import ai.genaifund.beyondpilot.notification.persistence.EmailTemplateOverride;
import ai.genaifund.beyondpilot.notification.persistence.EmailTemplateOverrideRepository;
import ai.genaifund.beyondpilot.notification.settings.DeliverySettings;
import ai.genaifund.beyondpilot.notification.template.DefaultTemplates;
import ai.genaifund.beyondpilot.notification.template.EmailKind;
import ai.genaifund.beyondpilot.notification.template.EmailRenderer;
import ai.genaifund.beyondpilot.notification.template.EmailTemplate;
import ai.genaifund.beyondpilot.notification.template.RenderedEmail;
import ai.genaifund.beyondpilot.notification.template.TemplateProblem;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with the wording of email: read it by kind, change it, put it back to the default, preview a draft
 * with sample values, and send a draft to themselves. A draft that does not pass the template checks is never stored,
 * so every stored template renders.
 */
@Service
public class EmailTemplateAdministration {

	private static final String RESOURCE = "email_template";

	private final IdentityService identity;

	private final DefaultTemplates defaults;

	private final EmailTemplateOverrideRepository overrides;

	private final EmailRenderer renderer;

	private final DeliverySettings delivery;

	private final EmailDelivery sender;

	private final AuditTrail audit;

	EmailTemplateAdministration(IdentityService identity, DefaultTemplates defaults,
			EmailTemplateOverrideRepository overrides, EmailRenderer renderer, DeliverySettings delivery,
			EmailDelivery sender, AuditTrail audit) {
		this.identity = identity;
		this.defaults = defaults;
		this.overrides = overrides;
		this.renderer = renderer;
		this.delivery = delivery;
		this.sender = sender;
		this.audit = audit;
	}

	/**
	 * Every kind operators can word, in catalog order.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public EmailTemplateListResponse list(Actor actor) {
		identity.requireOperator(actor);
		Map<String, EmailTemplateOverride> edited = new HashMap<>();
		overrides.findAll().forEach(override -> edited.put(override.getKind(), override));
		return new EmailTemplateListResponse(editable().map(kind -> {
			EmailTemplateOverride override = edited.get(kind.value());
			return new EmailTemplateListResponse.Item(kind.value(), kind.group().value(),
					override == null ? defaults.template(kind).subject() : override.getSubject(), override != null,
					override == null ? null : override.getUpdatedByLabel(),
					override == null ? null : override.getUpdatedAt());
		}).toList());
	}

	/**
	 * One kind's wording, its default and its variables.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such kind, or operators do not word it
	 */
	@Transactional(readOnly = true)
	public EmailTemplateResponse get(Actor actor, String kindValue) {
		identity.requireOperator(actor);
		EmailKind kind = editableKind(kindValue);
		return response(kind, overrides.findById(kind.value()));
	}

	/**
	 * Replaces one kind's wording.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such kind, it is not worded by operators, the draft does not pass
	 * the checks, or someone changed the wording since it was read
	 */
	@Transactional
	public EmailTemplateResponse save(Actor actor, String kindValue, SaveEmailTemplateRequest request) {
		Operator operator = identity.requireOperator(actor);
		EmailKind kind = editableKind(kindValue);
		EmailTemplate draft = new EmailTemplate(request.subject().strip(), request.body().strip());
		List<TemplateProblem> problems = renderer.problems(kind, draft);
		if (!problems.isEmpty()) {
			throw new NotificationException(NotificationErrorCode.TEMPLATE_INVALID,
					"The " + kind.value() + " template has " + problems.size() + " problems");
		}
		Optional<EmailTemplateOverride> current = overrides.findById(kind.value());
		Long readAt = request.version();
		if (current.isPresent() != (readAt != null)
				|| (current.isPresent() && current.get().getVersion() != readAt.longValue())) {
			throw changed(kind);
		}
		Instant now = Instant.now();
		EmailTemplateOverride override = current.orElseGet(() -> new EmailTemplateOverride(kind.value(),
				draft.subject(), draft.body(), operator.accountId(), operator.label(), now));
		override.reword(draft.subject(), draft.body(), operator.accountId(), operator.label(), now);
		try {
			override = overrides.saveAndFlush(override);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw changed(kind);
		}
		record(AuditAction.EMAIL_TEMPLATE_UPDATE, operator, kind);
		return response(kind, Optional.of(override));
	}

	/**
	 * Puts one kind back to its default wording.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such kind, or it is not worded by operators
	 */
	@Transactional
	public EmailTemplateResponse reset(Actor actor, String kindValue) {
		Operator operator = identity.requireOperator(actor);
		EmailKind kind = editableKind(kindValue);
		if (overrides.existsById(kind.value())) {
			overrides.deleteById(kind.value());
			record(AuditAction.EMAIL_TEMPLATE_RESET, operator, kind);
		}
		return response(kind, Optional.empty());
	}

	/**
	 * A draft rendered with the kind's sample values, and what keeps it from being saved. A draft with problems is
	 * not rendered; the default stands in.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such kind, or it is not worded by operators
	 */
	@Transactional(readOnly = true)
	public EmailPreviewResponse preview(Actor actor, String kindValue, EmailDraftRequest request) {
		identity.requireOperator(actor);
		EmailKind kind = editableKind(kindValue);
		EmailTemplate draft = new EmailTemplate(request.subject(), request.body());
		List<TemplateProblem> problems = renderer.problems(kind, draft);
		RenderedEmail email = sample(kind, problems.isEmpty() ? draft : defaults.template(kind));
		return new EmailPreviewResponse(email.subject(), email.html(), email.text(),
				problems.stream()
					.map(problem -> new EmailPreviewResponse.Problem(problem.type().name().toLowerCase(Locale.ROOT),
							problem.field(), problem.variable()))
					.toList());
	}

	/**
	 * Sends a draft, with sample values, to the operator's own address through the saved settings.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such kind, it is not worded by operators, or the draft does not
	 * pass the checks
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public EmailTestResponse test(Actor actor, String kindValue, EmailDraftRequest request) {
		Operator operator = identity.requireOperator(actor);
		EmailKind kind = editableKind(kindValue);
		EmailTemplate draft = new EmailTemplate(request.subject(), request.body());
		if (!renderer.problems(kind, draft).isEmpty()) {
			throw new NotificationException(NotificationErrorCode.TEMPLATE_INVALID,
					"The " + kind.value() + " draft does not pass the checks");
		}
		RenderedEmail email = sample(kind, draft);
		Optional<DeliveryFailure> failure = delivery.delivery()
			.map(saved -> sender.sendTest(saved, operator.email(),
					new RenderedEmail("[Test] " + email.subject(), email.html(), email.text())))
			.orElse(Optional.of(DeliveryFailure.NOT_CONFIGURED));
		return new EmailTestResponse(operator.email(), failure.isEmpty(), failure.map(DeliveryFailure::value).orElse(null));
	}

	private RenderedEmail sample(EmailKind kind, EmailTemplate template) {
		Map<String, Object> samples = new HashMap<>();
		kind.variables().forEach(variable -> samples.put(variable.name(), variable.sample()));
		return renderer.render(kind, template, samples, delivery.appearance());
	}

	private EmailTemplateResponse response(EmailKind kind, Optional<EmailTemplateOverride> override) {
		EmailTemplate standard = defaults.template(kind);
		List<EmailTemplateResponse.Variable> variables = kind.variables()
			.stream()
			.filter(variable -> !variable.quoted())
			.map(variable -> new EmailTemplateResponse.Variable(variable.name(), variable.required(),
					variable.sample() == null ? null : String.valueOf(variable.sample())))
			.toList();
		return override
			.map(edited -> new EmailTemplateResponse(kind.value(), kind.group().value(), edited.getSubject(),
					edited.getBody(), standard.subject(), standard.body(), variables, true, edited.getUpdatedByLabel(),
					edited.getUpdatedAt(), edited.getVersion()))
			.orElseGet(() -> new EmailTemplateResponse(kind.value(), kind.group().value(), standard.subject(),
					standard.body(), standard.subject(), standard.body(), variables, false, null, null, null));
	}

	private static Stream<EmailKind> editable() {
		return Arrays.stream(EmailKind.values()).filter(EmailKind::editable);
	}

	private static EmailKind editableKind(String value) {
		EmailKind kind = EmailKind.of(value)
			.orElseThrow(() -> new NotificationException(NotificationErrorCode.TEMPLATE_NOT_FOUND,
					"No kind of email is named " + value));
		if (!kind.editable()) {
			throw new NotificationException(NotificationErrorCode.TEMPLATE_NOT_EDITABLE,
					"Operators do not word " + kind.value());
		}
		return kind;
	}

	private static NotificationException changed(EmailKind kind) {
		return new NotificationException(NotificationErrorCode.TEMPLATE_CHANGED,
				"The " + kind.value() + " template changed since it was read");
	}

	private void record(AuditAction action, Operator operator, EmailKind kind) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(RESOURCE, kind.value(), kind.value()), Map.of()));
	}

}
