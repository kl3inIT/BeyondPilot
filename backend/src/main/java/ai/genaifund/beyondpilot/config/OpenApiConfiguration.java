package ai.genaifund.beyondpilot.config;

import java.util.List;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.servers.Server;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.NumberSchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The published API contract's shared parts. {@code OpenApiContractTest} writes the contract to {@code openapi.yml};
 * no runtime profile serves it (docs/conventions.md › Published API contracts).
 */
@Configuration(proxyBeanMethods = false)
@OpenAPIDefinition(
		info = @Info(title = "BeyondPilot API", version = "1.0.0",
				description = "The same-origin contract consumed by the BeyondPilot web application."),
		servers = @Server(url = "/", description = "Same origin as the web application"))
class OpenApiConfiguration {

	private static final String PROBLEM_SCHEMA = "Problem";

	private static final String CODE_PATTERN = "^[A-Z][A-Z0-9_]+[A-Z0-9]$";

	@Bean
	OpenApiCustomizer problemSchema() {
		return openApi -> {
			if (openApi.getComponents() == null) {
				openApi.setComponents(new Components());
			}
			openApi.getComponents().addSchemas(PROBLEM_SCHEMA, problem());
		};
	}

	/** The RFC 9457 problem every 4xx and 5xx response carries, closed to the members the error path writes. */
	private static Schema<?> problem() {
		ObjectSchema problem = new ObjectSchema();
		problem.setAdditionalProperties(false);
		problem.setRequired(List.of("title", "status", "requestId"));
		problem.addProperty("type", new StringSchema().format("uri")
			.description("`urn:beyondpilot:failure:<code in kebab case>` when `code` is present; omitted means `about:blank`."));
		problem.addProperty("title", new StringSchema().description("Short summary of the problem kind; never branch on it."));
		problem.addProperty("status", new IntegerSchema().format("int32").description("HTTP status code."));
		problem.addProperty("detail", new StringSchema().description("Safe human-readable explanation; never branch on it."));
		problem.addProperty("instance", new StringSchema().format("uri-reference")
			.description("Request path that produced the problem."));
		problem.addProperty("code", new StringSchema().pattern(CODE_PATTERN).maxLength(63)
			.description("Stable failure code for module failures and request validation; clients branch on it."));
		problem.addProperty("requestId", new StringSchema().format("uuid")
			.description("Identifier of the request in the server logs and the `X-Request-Id` header."));
		problem.addProperty("errors", new ArraySchema().items(violation())
			.description("Request validation only: one entry per violation. A rejected value is never echoed."));
		return problem;
	}

	private static Schema<?> violation() {
		ObjectSchema bounds = new ObjectSchema();
		bounds.setAdditionalProperties(false);
		bounds.addProperty("min", new NumberSchema());
		bounds.addProperty("max", new NumberSchema());

		ObjectSchema violation = new ObjectSchema();
		violation.setAdditionalProperties(false);
		violation.setRequired(List.of("pointer", "detail", "code"));
		violation.addProperty("pointer", new StringSchema()
			.description("JSON Pointer to the offending member, for example `#/title`."));
		violation.addProperty("detail", new StringSchema().description("Safe fallback text; clients translate by code."));
		violation.addProperty("code", new StringSchema().pattern(CODE_PATTERN)
			.description("Constraint code, for example `NOT_BLANK` or `SIZE`."));
		violation.addProperty("params", bounds.description("Numeric bounds of the constraint; omitted when it has none."));
		return violation;
	}
}
