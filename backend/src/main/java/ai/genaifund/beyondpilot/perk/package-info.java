/**
 * Perks: what an organization gives to the members of BeyondPilot, such as credits or a free plan, who may get each
 * and how, and the claims of the teams that got them (BEY-247). A perk belongs to the organization that gives it and
 * may go with that organization's solutions; who may get it is read from the programs a team applied to. Offers
 * (BEY-148, BEY-217) became perks.
 */
@ApplicationModule(displayName = "Perk", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "organization", "program", "proposal", "solution",
				"shared" })
@NullMarked
package ai.genaifund.beyondpilot.perk;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
