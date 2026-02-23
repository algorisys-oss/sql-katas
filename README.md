# SQL Katas

An interactive SQL learning playground that teaches SQL as a language for reasoning about data — not just querying it.

## What is this?

SQL Katas is a structured, hands-on platform for learning SQL from foundations to advanced analytical queries. Learners progress through phased exercises (katas) with a live query editor, visual result tables, and execution plan viewer.

## Learning Path

| Phase | Topic | Focus |
|-------|-------|-------|
| 0 | Relational Thinking | Tables, keys, constraints, normalization, NULL logic |
| 1 | Basic SELECT | SELECT, FROM, WHERE, ORDER BY, LIMIT |
| 2 | Filtering & Conditions | Operators, CASE, type casting, string/date functions |
| 3 | Aggregation & GROUP BY | COUNT, SUM, AVG, GROUP BY, HAVING |
| 4 | Joins & Relationships | INNER, LEFT, RIGHT, FULL JOIN, join explosions |
| 5 | Subqueries & CTEs | Scalar, correlated, recursive CTEs |
| 6 | Advanced Filtering | EXISTS, anti-joins, set operations, deduplication |
| 7 | Window Functions | OVER, PARTITION BY, ROW_NUMBER, RANK, LAG/LEAD |
| 8 | Advanced Analytics | Running totals, moving averages, gaps & islands |
| 9 | Execution & Performance | EXPLAIN plans, indexes, performance pitfalls |
| 10 | Real-World Challenges | Interview problems, business analytics, reporting |

## Tech Stack

- **Frontend:** SolidJS + Tailwind CSS
- **Backend:** Bun + Elysia
- **Database:** PostgreSQL (V1)
- **Linting:** Biome
- **Testing:** Bun test (backend), Vitest (frontend)

## Project Structure

```
sql-katas/
├── frontend/              # SolidJS + Tailwind CSS application
├── backend/               # Bun + Elysia API server
│   └── seeds/             # Idempotent database seed scripts
├── docker-compose.yml     # PostgreSQL 17
├── biome.json             # Lint & format config
├── TODO.md                # Project status tracker
└── README.md
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (runtime)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 17 on port 5432 with:
- Database: `sql_katas`
- User: `postgres` / Password: `postgres`

### 2. Install dependencies

```bash
cd backend && bun install
cd ../frontend && bun install
```

### 3. Seed the database

```bash
cd backend && bun run seed
```

Creates the e-commerce schema (categories, products, tags, customers, orders, order_items) with sample data and a read-only `sql_katas_learner` role.

### 4. Run the app

```bash
# Terminal 1 — backend (port 8080)
cd backend && bun dev

# Terminal 2 — frontend (port 3000)
cd frontend && bun dev
```

Open [http://localhost:3000](http://localhost:3000)

## Connecting to a Different Database

By default the app connects to the Docker Compose PostgreSQL on `localhost:5432`. Override with environment variables to connect to any Postgres instance:

```bash
# Full connection string
DATABASE_URL=postgres://user:pass@myhost:5432/mydb bun dev

# Learner (sandboxed) connection — separate URL
LEARNER_DATABASE_URL=postgres://reader:pass@myhost:5432/mydb bun dev

# Or use individual vars for the learner connection
DB_HOST=10.0.0.5 DB_PORT=5433 DB_NAME=sql_katas \
LEARNER_DB_USER=sql_katas_learner LEARNER_DB_PASSWORD=learner \
bun dev
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Admin connection (seed, reset) | `postgres://postgres:postgres@localhost:5432/sql_katas` |
| `LEARNER_DATABASE_URL` | Sandboxed learner connection (query execution) | Built from individual vars below |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `sql_katas` |
| `LEARNER_DB_USER` | Learner role username | `sql_katas_learner` |
| `LEARNER_DB_PASSWORD` | Learner role password | `learner` |

## Development

```bash
# Testing
cd backend && bun test
cd frontend && bunx vitest

# Linting
bunx biome check .

# Reset database to seed state
# (also available via the "Reset Dataset" button in the UI)
cd backend && bun run seed

# Stop PostgreSQL
docker compose down

# Stop and wipe data
docker compose down -v
```

## Roadmap

- **V1** — PostgreSQL as the sole database backend
- **V2** — Multi-database support (MySQL, SQLite, SQL Server, Oracle)

See [TODO.md](TODO.md) for detailed task tracking.
