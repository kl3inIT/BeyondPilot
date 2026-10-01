package ai.genaifund.beyondpilot;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/**
 * Keeps {@code openapi.yml} at the repository root equal to the contract the full application describes. With
 * {@code BEYONDPILOT_OPENAPI_WRITE=true} the test rewrites the file instead (docs/conventions.md › Published API
 * contracts).
 */
@SpringBootTest(properties = "springdoc.api-docs.enabled=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OpenApiContractTest {

	private static final String WRITE_FLAG = "BEYONDPILOT_OPENAPI_WRITE";

	@Autowired
	private MockMvcTester mvc;

	@Test
	void committedContractMatchesTheApplication() throws Exception {
		MvcTestResult result = mvc.get().uri("/v3/api-docs.yaml").exchange();
		assertThat(result).hasStatusOk();
		String generated = normalize(result.getResponse().getContentAsString(UTF_8));

		Path contract = repositoryRoot().resolve("openapi.yml");
		if (Boolean.parseBoolean(System.getenv(WRITE_FLAG))) {
			Files.writeString(contract, generated, UTF_8);
			return;
		}

		assertThat(Files.exists(contract)).as("openapi.yml is missing; " + refreshHint()).isTrue();
		assertThat(normalize(Files.readString(contract, UTF_8))).as("openapi.yml is stale; " + refreshHint())
			.isEqualTo(generated);
	}

	/** Git may check the file out with CRLF line endings on Windows; the contract itself is LF. */
	private static String normalize(String yaml) {
		String lf = yaml.replace("\r\n", "\n");
		return lf.endsWith("\n") ? lf : lf + "\n";
	}

	private static String refreshHint() {
		return "refresh it with " + WRITE_FLAG + "=true ./gradlew :backend:test --tests '*OpenApiContractTest'";
	}

	private static Path repositoryRoot() {
		Path candidate = Path.of("").toAbsolutePath();
		while (candidate != null && !Files.exists(candidate.resolve("settings.gradle.kts"))) {
			candidate = candidate.getParent();
		}
		if (candidate == null) {
			throw new IllegalStateException("No settings.gradle.kts above " + Path.of("").toAbsolutePath());
		}
		return candidate;
	}
}
