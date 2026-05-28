FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Render expects services to listen on the port defined by the $PORT environment variable
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]