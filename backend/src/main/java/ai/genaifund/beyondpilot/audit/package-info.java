/**
 * The record of sensitive changes: who did what to what, and when. A module that changes who may do something, or
 * touches something sensitive, records it through {@link ai.genaifund.beyondpilot.audit.AuditTrail} in the transaction
 * of the change. Events are written once and never changed. The module knows no other module: a caller supplies the
 * names its events carry.
 */
@ApplicationModule(displayName = "Audit", type = ApplicationModule.Type.CLOSED, allowedDependencies = {})
@NullMarked
package ai.genaifund.beyondpilot.audit;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
