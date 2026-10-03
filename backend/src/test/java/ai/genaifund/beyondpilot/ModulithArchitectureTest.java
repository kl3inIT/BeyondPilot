package ai.genaifund.beyondpilot;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModule;
import org.springframework.modulith.core.ApplicationModules;

/**
 * Keeps the module structure a repository contract: every module is closed, declares its dependencies and appears in
 * this list, so adding a module or a dependency edge is a visible, reviewed change.
 */
class ModulithArchitectureTest {

	private static final Set<String> MODULES = Set.of("config", "identity", "notification");

	private final ApplicationModules modules = ApplicationModules.of(BeyondPilotApplication.class);

	@Test
	void modulesAreClosedAndListed() {
		modules.verify();

		assertThat(modules.stream().map(ModulithArchitectureTest::name)).containsExactlyInAnyOrderElementsOf(MODULES);
		modules.forEach(module -> assertThat(module.isOpen()).as("%s must be closed", name(module)).isFalse());
	}

	private static String name(ApplicationModule module) {
		return module.getIdentifier().toString();
	}
}
