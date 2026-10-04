package ai.genaifund.beyondpilot;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModule;
import org.springframework.modulith.core.ApplicationModules;

/**
 * Keeps the module structure a repository contract: every module is closed, declares its dependencies and appears in
 * this list, so adding a module or a dependency edge is a visible, reviewed change.
 */
class ModulithArchitectureTest {

	private static final Set<String> MODULES = Set.of("audit", "config", "identity", "notification", "program",
			"storage");

	private final ApplicationModules modules = ApplicationModules.of(BeyondPilotApplication.class);

	@Test
	void modulesAreClosedAndListed() {
		modules.verify();

		assertThat(modules.stream().map(ModulithArchitectureTest::name)).containsExactlyInAnyOrderElementsOf(MODULES);
		modules.forEach(module -> assertThat(module.isOpen()).as("%s must be closed", name(module)).isFalse());
	}

	/**
	 * A controller routes: it takes the request, calls an application service and returns its record. Reading or writing
	 * through a repository from a controller would skip the service's authorization, validation and transaction.
	 */
	@Test
	void controllersReachPersistenceOnlyThroughAnApplicationService() {
		JavaClasses application = new ClassFileImporter().withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
			.importPackagesOf(BeyondPilotApplication.class);

		noClasses().that()
			.resideInAPackage("..web..")
			.should()
			.dependOnClassesThat()
			.resideInAPackage("..persistence..")
			.because("a controller calls an application service, never a repository or an entity")
			.check(application);
	}

	private static String name(ApplicationModule module) {
		return module.getIdentifier().toString();
	}
}
