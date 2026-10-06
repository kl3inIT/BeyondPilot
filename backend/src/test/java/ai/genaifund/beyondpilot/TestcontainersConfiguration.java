package ai.genaifund.beyondpilot;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		// The database staging runs: the official postgres:18.6 with pgvector.
		return new PostgreSQLContainer(
				DockerImageName.parse("pgvector/pgvector:0.8.7-pg18-trixie").asCompatibleSubstituteFor("postgres"));
	}

}
