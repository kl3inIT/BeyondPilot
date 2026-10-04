/**
 * The programs GenAI Fund runs: what each is, when it takes applications, its key dates and its events. Operators
 * create and edit every program through {@link ai.genaifund.beyondpilot.program.ProgramAdministration}.
 */
@ApplicationModule(displayName = "Program", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity" })
@NullMarked
package ai.genaifund.beyondpilot.program;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
