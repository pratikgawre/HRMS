FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/hrms-backend-0.0.1-SNAPSHOT.jar app.jar

ENV PORT=10000

EXPOSE 10000

ENTRYPOINT ["java", "-jar", "app.jar"]
