FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Pass Hugging Face Spaces secrets as build arguments
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE

# Map build arguments to environment variables so Vite can embed them
ENV VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN}
ENV VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID}
ENV VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE}

COPY pom.xml .
COPY src ./src
COPY frontend ./frontend

RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Hugging Face natively routes web traffic to port 7860
ENV PORT=7860
EXPOSE 7860
# -Xmx10g gives Java 10 Gigabytes of RAM so the AI model never crashes
ENTRYPOINT ["java", "-Xmx10g", "-Dserver.port=${PORT}", "-jar", "app.jar"]