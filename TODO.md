# SQL Katas — Project Status

## Infrastructure

- [x] Initialize backend project (Bun + Elysia)
- [x] Initialize frontend project (SolidJS + Tailwind CSS)
- [x] Set up Biome for linting/formatting
- [x] Set up PostgreSQL database and connection (Docker Compose + flexible env vars)
- [x] Create read-only database role for learner queries (in seed script)
- [x] Implement query execution sandbox (timeouts, row limits, SELECT-only)
- [x] Set up seed script runner (`backend/seeds/`)

## Sample Datasets

- [x] Design unified e-commerce schema (categories, products, tags, product_tags, customers, orders, order_items)
- [x] Write seed data with intentional NULLs, duplicates, and edge cases
- [x] Add time-series data for window function exercises (order dates spanning 2024–2025)
- [x] Implement dataset reset endpoint (POST `/api/reset`)

## Backend API

- [x] POST `/api/query` — execute learner SQL (read-only, sandboxed)
- [x] POST `/api/explain` — return query execution plan (changed from GET — SQL in body)
- [x] POST `/api/reset` — reset dataset to seed state
- [x] Error responses with educational messages
- [x] GET `/api/katas` — list all katas grouped by phase
- [x] GET `/api/katas/:id` — get full kata with markdown content
- [x] Kata content loader (auto-discovers `katas/phase-*/*.md` files)

## Frontend — Core UI

- [x] Landing page with Katas and Applications (Coming Soon) cards
- [x] Kata browser / sidebar navigation (Phases 0–10)
- [x] SQL query editor component (CodeMirror 6 + PostgreSQL dialect)
- [x] Result table component (with row limit display, NULL styling, client-side pagination)
- [ ] Execution plan viewer component
- [x] Error display with educational context
- [x] Dataset reset button
- [x] Markdown content renderer (code block placeholders, CSS classes, tables)
- [x] Kata page with split layout (markdown left, SQL editor + results right)
- [x] Resizable and maximizable code panel on kata page

## Kata Content — Phase 0: Relational Thinking

- [x] 0A — Tables & Structure (data types, schemas)
- [x] 0B — Keys & Constraints (PK, FK, UNIQUE, NOT NULL, CHECK)
- [x] 0C — Relationships (1:1, 1:N, M:N, junction tables, ER diagrams)
- [x] 0D — Normalization & Denormalization (1NF, 2NF, 3NF, tradeoffs)
- [x] 0E — NULL & Three-Valued Logic

## Kata Content — Phase 1: Basic SELECT

- [x] SELECT, FROM, WHERE
- [x] DISTINCT
- [x] ORDER BY
- [x] LIMIT / OFFSET

## Kata Content — Phase 2: Filtering & Conditions

- [x] Comparison operators, AND/OR/NOT
- [x] IN, BETWEEN, LIKE
- [x] NULL handling (IS NULL, COALESCE, NULLIF)
- [x] CASE expressions
- [x] Type casting
- [x] String functions
- [x] Date/time functions

## Kata Content — Phase 3: Aggregation & GROUP BY

- [x] COUNT, SUM, AVG, MIN, MAX
- [x] GROUP BY
- [x] HAVING
- [x] Grouping vs filtering logic

## Kata Content — Phase 4: Joins & Relationships

- [x] INNER JOIN
- [x] LEFT JOIN
- [x] RIGHT JOIN
- [x] FULL JOIN
- [x] Join conditions vs filters
- [x] Join explosion and duplication

## Kata Content — Phase 5: Subqueries & CTEs

- [x] Scalar subqueries
- [x] Correlated subqueries
- [x] WITH (CTEs)
- [x] Recursive CTEs (hierarchical data)
- [x] Subqueries vs CTEs vs derived tables

## Kata Content — Phase 6: Advanced Filtering

- [x] EXISTS vs IN
- [x] Anti-joins
- [x] UNION, INTERSECT, EXCEPT
- [x] Deduplication strategies

## Kata Content — Phase 7: Window Functions

- [x] OVER() clause
- [x] PARTITION BY
- [x] ROW_NUMBER, RANK, DENSE_RANK
- [x] LAG, LEAD
- [x] Window frames

## Kata Content — Phase 8: Advanced Analytics

- [ ] Running totals
- [ ] Moving averages
- [ ] Sessionization
- [ ] Top-N per group
- [ ] Gaps and islands

## Kata Content — Phase 9: Execution & Performance

- [ ] Logical vs physical execution order
- [ ] Reading EXPLAIN / EXPLAIN ANALYZE
- [ ] Indexes (B-tree, composite, covering, selectivity)
- [ ] Common performance pitfalls

## Kata Content — Phase 10: Real-World Challenges

- [ ] Classic SQL interview problems
- [ ] Business analytics queries
- [ ] Reporting queries
- [ ] Data cleanup and transformation

## Testing

- [ ] Backend: query sandbox safety tests (timeout, DDL blocking, row limits)
- [ ] Backend: API endpoint tests
- [ ] Backend: seed data setup/teardown tests
- [ ] Frontend: query editor component tests
- [ ] Frontend: result rendering tests
- [ ] Frontend: error display tests

## Future (V2)

- [ ] Multi-database support architecture
- [ ] MySQL adapter
- [ ] SQLite adapter
- [ ] SQL dialect comparison highlights
- [ ] Applications section content
