# syntax=docker/dockerfile:1.7
# Build from the repository root: docker build -f backend/Dockerfile .

FROM eclipse-temurin:25-jdk-noble@sha256:589ff4cc3f71aab462e7048a47a0d10edf57fbccde3fceea2281e610bf5880b4 AS build

WORKDIR /workspace

# Gradle and the dependencies live in their own layer, before any source, so a change to the code reuses them and
# the registry layer cache of CI can restore them.
ENV GRADLE_USER_HOME=/workspace/.gradle-home
COPY gradlew settings.gradle.kts ./
COPY gradle ./gradle
COPY backend/build.gradle.kts ./backend/
RUN sed -i 's/\r$//' gradlew \
    && chmod 0755 gradlew \
    && ./gradlew --no-daemon --stacktrace :backend:resolveDependencies

COPY backend/src/main ./backend/src/main
RUN ./gradlew --no-daemon --stacktrace :backend:bootJar \
    && jar="$(find backend/build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' -print -quit)" \
    && test -n "${jar}" \
    && cp "${jar}" application.jar \
    && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

FROM eclipse-temurin:25-jre-noble@sha256:d9a39a23634650173f1e2bbc176227af9728587ecf0f4b62d53e9355cd7a19ab

ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="BeyondPilot API" \
      org.opencontainers.image.source="https://github.com/kl3inIT/BeyondPilot" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# A fixed identity, so a secret file on the host can be owned by it and nothing else.
RUN groupadd --system --gid 1654 beyondpilot \
    && useradd --system --uid 1654 --gid 1654 --no-create-home --shell /usr/sbin/nologin beyondpilot \
    && install -d -o 1654 -g 1654 -m 0750 /var/lib/beyondpilot/storage

WORKDIR /application
COPY --from=build --chown=1654:1654 /workspace/extracted/dependencies/ ./
COPY --from=build --chown=1654:1654 /workspace/extracted/spring-boot-loader/ ./
COPY --from=build --chown=1654:1654 /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=1654:1654 /workspace/extracted/application/ ./

# Deployed secrets are files under /run/secrets, read by Spring's configtree import of the production profile.
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    BEYONDPILOT_STORAGE_LOCAL_DIRECTORY=/var/lib/beyondpilot/storage \
    JAVA_TOOL_OPTIONS="-XX:InitialRAMPercentage=20 -XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8"

USER 1654:1654
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "application.jar"]
