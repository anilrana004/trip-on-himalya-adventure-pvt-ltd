# Railway monorepo entrypoint — builds the Spring Boot API in backend/
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY backend/pom.xml .
RUN mvn -q dependency:go-offline
COPY backend/src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:25-jre
WORKDIR /app
# curl is only for the container healthcheck. Railway itself polls
# /actuator/health over the published PORT and does not use this instruction.
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/target/securetravels-crm-0.1.0.jar app.jar
USER 1000:1000
EXPOSE 8080
ENV PORT=8080
# Non-secret production defaults (secrets stay in Railway Variables — never bake JWT here).
ENV SPRING_PROFILES_ACTIVE=prod
ENV MESSAGING_MODE=INLINE
ENV WHATSAPP_MODE=SANDBOX
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/actuator/health" || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
