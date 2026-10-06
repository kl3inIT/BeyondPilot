# Production-first persistence

## Policy

Data with a lifecycle beyond one process, or data that must survive a restart or a deployment, uses PostgreSQL, versioned Flyway migrations, database-enforced constraints, transactions, backup and recovery in the same increment.

In-memory or H2 databases are allowed only for isolated tests or explicitly disposable experiments. They never replace the PostgreSQL path to reduce scope; repository and migration tests run against PostgreSQL through Testcontainers.

A temporary runtime profile, command or endpoint is not a substitute for a missing product write flow ([change design](../conventions.md#change-design)).

## Schema ownership

- Flyway owns the schema. Hibernate only validates it (`spring.jpa.hibernate.ddl-auto: validate`), `spring.jpa.open-in-view` is `false`, and the second-level and query caches are disabled.
- Migrations live in `backend/src/main/resources/db/migration` and are named `V<n>__<module>_<description>.sql` in snake case, for example `V3__proposal_create_submissions.sql`.
- Every table has exactly one owning module. Only the owner writes it and only the owner's `persistence` package reads it; other modules use the owner's published API.
- A table a framework reads and writes is created by Flyway too, in the migration of the module that needs it, and only the framework touches it: `identity` creates Spring Session's `spring_session` tables, and `search` creates Spring Modulith's `event_publication` (in `V15__matching_create_event_publication.sql`, named before the module was), the registry of [events between modules](../conventions.md#events-between-modules).
- Uniqueness, referential integrity and deletion behavior belong in database constraints when the database is the final concurrency authority.

## Implementation boundaries

- Application services own authorization, input validation, orchestration, transaction boundaries, domain transition decisions and typed failure mapping. They do not inject `JdbcClient`, contain SQL, map rows or implement lock mechanics.
- Persistence lives in the owning module's `persistence` package. Use Spring Data `JpaRepository` for entity lifecycle, declarative queries and ORM locks (`@Query`, `@Lock`, `@Modifying`). Use a concrete `@Repository` class with `JdbcClient` for SQL projections, claims, bulk updates and PostgreSQL-specific mechanics.
- A module has what its screens need, not a fixed set of files: entities and a `JpaRepository` when it has a create, edit or state-change flow; a `JdbcClient` query repository when it has a list, filter, search or count screen, which maps rows straight to the response record. A module that only reads has no entity until its first write flow.
- Group repositories by aggregate, use case, projection or consistency boundary, not one repository per table. Read projections get their own query repository rather than inflating a write repository.
- Do not add a repository interface for a single internal JDBC implementation; inject the concrete class inside the module. Framework-implemented Spring Data interfaces are fine.
- Do not create parallel domain, entity, DTO and mapper layers. Entities and their relationships stay inside their module; an entity never holds a relationship to another module's entity, only its identifier.
- Keep `@Transactional` on the application operation when one command coordinates several repositories. JPA and `JdbcClient` share one DataSource and transaction manager.
- Declare every to-one association `fetch = FetchType.LAZY` explicitly.
- Choose the fetch plan per use case: `JOIN FETCH` or `@EntityGraph` on the repository method, or a JDBC projection. Never read a lazy association outside the transaction that loaded it, and never let a list read issue one query per row.
- Do not override an entity's `equals` and `hashCode` on its generated identifier; use a stable business key when identity comparison is needed.
- An entity that concurrent commands may change carries `@Version`, or every writer takes an explicit lock first.
- Defer Querydsl or jOOQ until measured dynamic-query or type-safety pressure justifies them.

## Schema evolution

- **Until the first staging deployment holds data**, migrations may be rewritten and local databases recreated. A pull request that rewrites a merged migration says so, because every developer must recreate their local database.
- **From the first staging deployment onward**, record its date here. Migrations are then forward-only and append-only: never edit an applied migration or its checksum, and never reset, recreate or squash a database, schema or table to reach a cleaner model.
- A change to an existing shape transforms the existing rows in the migration, or in a bounded, idempotent backfill, and states what is kept, converted or deliberately lost. Losing data that users created needs a recorded owner decision.
- A migration that the previous release cannot run against is called out in the pull request, because rollback is then a database restore.

## Operations

- Local development uses the PostgreSQL container in `backend/compose.yaml`, started by Spring Boot Docker Compose support ([development runtime](../runbooks/development-runtime.md)).
- Staging and production hosting, backup and restore are decided in BEY-12. Once a database holds real data, a backup is taken before every migration.
- The connection pool is a fixed-size HikariCP pool with explicit `connection-timeout`, `max-lifetime` and `leak-detection-threshold`, sized for the database host.
- Database credentials are managed values outside Git ([data and security](../conventions.md#data-and-security)).
