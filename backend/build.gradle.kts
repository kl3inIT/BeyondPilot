plugins {
	java
	alias(libs.plugins.spring.boot)
	alias(libs.plugins.spring.dependency.management)
}

group = "ai.genaifund"
version = "0.0.1-SNAPSHOT"
description = "BeyondPilot backend"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencyManagement {
	imports {
		mavenBom(libs.spring.modulith.bom.get().toString())
		mavenBom(libs.spring.ai.bom.get().toString())
		mavenBom(libs.aws.sdk.bom.get().toString())
	}
}

dependencies {
	implementation(libs.spring.boot.starter.actuator)
	implementation(libs.spring.boot.starter.data.jpa)
	implementation(libs.spring.boot.starter.flyway)
	implementation(libs.spring.boot.starter.mail)
	implementation(libs.spring.boot.starter.security)
	implementation(libs.spring.boot.starter.security.oauth2.client)
	implementation(libs.spring.boot.starter.session.jdbc)
	implementation(libs.spring.boot.starter.validation)
	implementation(libs.spring.boot.starter.webmvc)
	implementation(libs.flyway.database.postgresql)
	implementation(libs.spring.modulith.starter.jdbc)
	// Embeddings for search over an OpenAI-compatible API; the other OpenAI models stay off (application.yaml).
	implementation(libs.spring.ai.starter.model.openai)
	implementation(libs.springdoc.webmvc.api)
	// The SDK speaks HTTP through the JDK. Its default clients bring Apache HttpClient 5 and Netty onto the classpath,
	// where Spring would pick HttpClient 5 for every RestClient and wait out a Retry-After before retrying a 429.
	implementation(libs.aws.sdk.s3) {
		exclude(group = "software.amazon.awssdk", module = "apache5-client")
		exclude(group = "software.amazon.awssdk", module = "netty-nio-client")
	}
	implementation(libs.aws.sdk.url.connection.client)
	developmentOnly(libs.spring.boot.docker.compose)
	runtimeOnly(libs.postgresql)
	testImplementation(libs.spring.boot.starter.actuator.test)
	testImplementation(libs.spring.boot.starter.data.jpa.test)
	testImplementation(libs.spring.boot.starter.flyway.test)
	testImplementation(libs.spring.boot.starter.mail.test)
	testImplementation(libs.spring.boot.starter.security.test)
	testImplementation(libs.spring.boot.starter.security.oauth2.client.test)
	testImplementation(libs.spring.boot.starter.session.jdbc.test)
	testImplementation(libs.spring.boot.starter.validation.test)
	testImplementation(libs.spring.boot.starter.webmvc.test)
	testImplementation(libs.spring.boot.testcontainers)
	testImplementation(libs.spring.modulith.starter.test)
	testImplementation(libs.testcontainers.junit.jupiter)
	testImplementation(libs.testcontainers.postgresql)
	testRuntimeOnly(libs.junit.platform.launcher)
}

// A deprecated API is a build failure, so an upgrade never leaves one behind unnoticed.
tasks.withType<JavaCompile> {
	options.compilerArgs.addAll(listOf("-Xlint:deprecation,removal", "-Werror"))
}

// The image build (backend/Dockerfile) downloads the build classpaths in a layer of their own, before the sources
// are copied, so a change to the code reuses the downloaded dependencies.
tasks.register("resolveDependencies") {
	notCompatibleWithConfigurationCache("Resolves configurations at execution time")
	val names = setOf("compileClasspath", "runtimeClasspath", "productionRuntimeClasspath", "annotationProcessor")
	doLast {
		project.configurations.filter { it.name in names && it.isCanBeResolved }.forEach { it.resolve() }
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}

tasks.named<Test>("test") {
	// OpenApiContractTest compares against, or with the flag rewrites, the committed contract.
	inputs.files(rootProject.file("openapi.yml")).withPropertyName("openApiContract").optional()
	inputs.property("openApiWrite", providers.environmentVariable("BEYONDPILOT_OPENAPI_WRITE").orElse("false"))
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	// Local settings and secrets come from the git-ignored .env at the repository root (.env.example
	// names them). Only this task reads the file; a deployed application takes its environment as is.
	val localEnvironment = rootProject.file(".env")
	if (localEnvironment.exists()) {
		localEnvironment.readLines()
			.map { it.trim() }
			.filter { it.isNotEmpty() && !it.startsWith("#") && it.contains("=") }
			.forEach { environment(it.substringBefore("=").trim(), it.substringAfter("=").trim()) }
	}
}
