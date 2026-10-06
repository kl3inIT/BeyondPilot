package ai.genaifund.beyondpilot;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * Keeps the migrations a single line of versions. Two branches that each take the next number both pass on their own
 * and collide once merged, and Flyway then refuses to start with an error far from the cause; this test names the files
 * and the fix (docs/guidelines/persistence.md › Schema ownership).
 */
class MigrationVersionsTest {

	private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");

	private static final Pattern NAME = Pattern.compile("V(\\d+)__([a-z]+)_[a-z0-9_]+\\.sql");

	@Test
	void everyMigrationHasAVersionOfItsOwnAndTheNamingRule() throws IOException {
		List<String> files;
		try (Stream<Path> listed = Files.list(MIGRATIONS)) {
			files = listed.map(path -> path.getFileName().toString()).sorted().toList();
		}

		assertThat(files).as("migrations named V<n>__<module>_<description>.sql in snake case")
			.allMatch(file -> NAME.matcher(file).matches());

		TreeMap<Integer, List<String>> byVersion = files.stream()
			.collect(Collectors.groupingBy(MigrationVersionsTest::version, TreeMap::new, Collectors.toList()));
		Map<Integer, List<String>> shared = byVersion.entrySet()
			.stream()
			.filter(entry -> entry.getValue().size() > 1)
			.collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, TreeMap::new));
		assertThat(shared)
			.as("versions taken by more than one migration; renumber yours after the highest on main, %d",
					byVersion.isEmpty() ? 0 : byVersion.lastKey())
			.isEmpty();
	}

	private static int version(String file) {
		Matcher matcher = NAME.matcher(file);
		return matcher.matches() ? Integer.parseInt(matcher.group(1)) : -1;
	}

}
