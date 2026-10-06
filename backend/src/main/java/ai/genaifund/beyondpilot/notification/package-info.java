/**
 * The email BeyondPilot sends. A module that needs an email calls {@link
 * ai.genaifund.beyondpilot.notification.EmailService}; the sign-in code arrives as {@link
 * ai.genaifund.beyondpilot.identity.SignInCodeRequested}, because {@code identity} does not depend on this module.
 * Email is rendered from wording operators may edit, queued in the caller's transaction, and handed after commit to the
 * provider operators configured: Amazon SES, Resend or an SMTP server.
 */
@ApplicationModule(displayName = "Notification", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity" })
@NullMarked
package ai.genaifund.beyondpilot.notification;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
