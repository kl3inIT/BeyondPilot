package ai.genaifund.beyondpilot.notification;

import ai.genaifund.beyondpilot.identity.SignInCodeRequested;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Sends a sign-in code while the request that asked for it waits. The listener is synchronous on purpose and is not an
 * {@code @ApplicationModuleListener}: the code must never be written to the event publication registry, and the person
 * on the screen must learn at once whether it left. A failure is thrown back to the publisher as a
 * {@link NotificationException}, a {@code SERVICE_UNAVAILABLE} business failure.
 */
@Component
class SignInCodeMail {

	private final EmailService emails;

	SignInCodeMail(EmailService emails) {
		this.emails = emails;
	}

	@EventListener
	void send(SignInCodeRequested requested) {
		emails.sendSignInCode(requested.email(), requested.code(), requested.validFor());
	}

}
