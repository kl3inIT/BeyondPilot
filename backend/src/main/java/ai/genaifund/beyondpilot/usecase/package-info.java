/**
 * The business problems organizations want solved with AI, each published as an opportunity that providers answer with
 * proposals. Operators create them for an organization through
 * {@link ai.genaifund.beyondpilot.usecase.UseCaseAdministration}. A use case is for an approved enterprise, known by
 * its identifier, and it is closed once its close date has passed. It may belong to programs, which it names by
 * identifier through the program module.
 */
@ApplicationModule(displayName = "Use case", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "organization", "program", "storage" })
@NullMarked
package ai.genaifund.beyondpilot.usecase;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
