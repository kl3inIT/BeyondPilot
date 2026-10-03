/**
 * Sends the application's email. It knows no other module: a module that needs an email calls {@link
 * ai.genaifund.beyondpilot.notification.EmailService}, which owns the wording in both languages.
 */
@ApplicationModule(displayName = "Notification", type = ApplicationModule.Type.CLOSED, allowedDependencies = {})
@NullMarked
package ai.genaifund.beyondpilot.notification;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
