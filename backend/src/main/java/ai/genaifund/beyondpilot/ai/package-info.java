/**
 * The AI providers BeyondPilot calls and their keys. Operators connect a provider for a purpose in Admin › AI; the
 * module that uses it reads its connection here. A key is stored sealed and leaves this module only on its way to the
 * provider it was given for.
 */
@ApplicationModule(displayName = "AI", type = ApplicationModule.Type.CLOSED, allowedDependencies = { "audit", "identity" })
@NullMarked
package ai.genaifund.beyondpilot.ai;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
