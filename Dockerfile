FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Hugging Face natively routes web traffic to port 7860
ENV PORT=7860
EXPOSE 7860
# -Xmx10g gives Java 10 Gigabytes of RAM so the AI model never crashes
ENTRYPOINT ["java", "-Xmx10g", "-Dserver.port=${PORT}", "-jar", "app.jar"]