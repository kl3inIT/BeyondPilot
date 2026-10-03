/**
 * Who is signed in: accounts, sign-in with Google and with an emailed link, and the platform role. Other modules
 * receive the caller as an {@link ai.genaifund.beyondpilot.identity.Actor} through {@link
 * ai.genaifund.beyondpilot.identity.CurrentActor}.
 */
@ApplicationModule(displayName = "Identity", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "notification" })
@NullMarked
package ai.genaifund.beyondpilot.identity;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
