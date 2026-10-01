/**
 * Cross-cutting HTTP configuration that no module owns: the request identifier, the single exception handler and the
 * error endpoint, which together render every failure as an RFC 9457 problem (docs/conventions.md › API errors).
 */
@ApplicationModule(displayName = "Configuration", type = ApplicationModule.Type.CLOSED, allowedDependencies = {})
@NullMarked
package ai.genaifund.beyondpilot.config;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
