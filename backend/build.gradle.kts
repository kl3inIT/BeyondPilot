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
	implementation(libs.spring.modulith.starter.core)
	implementation(libs.springdoc.webmvc.api)
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

tasks.withType<Test> {
	useJUnitPlatform()
}

tasks.named<Test>("test") {
	// OpenApiContractTest compares against, or with the flag rewrites, the committed contract.
	inputs.files(rootProject.file("openapi.yml")).withPropertyName("openApiContract").optional()
	inputs.property("openApiWrite", providers.environmentVariable("BEYONDPILOT_OPENAPI_WRITE").orElse("false"))
}
