/**
 * The conversations people have on BeyondPilot: with the person behind a talent profile, with the organization that
 * offers a solution, and with GenAI Fund about a program. A first message to someone new waits as a request until the
 * other side accepts, declines or reports it; from then on both sides write, and a page that stays open hears each
 * message as it is written. Nobody's email address is shown to the other side.
 */
@ApplicationModule(displayName = "Messaging", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "organization", "program", "solution", "talent" })
@NullMarked
package ai.genaifund.beyondpilot.messaging;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
