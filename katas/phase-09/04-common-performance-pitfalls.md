---
id: common-performance-pitfalls
phase: 9
phase_title: Query Execution & Performance Awareness
sequence: 4
title: Common Performance Pitfalls
---

## Description

### Patterns That Silently Kill Performance

Most SQL performance problems aren't caused by complex queries — they come from **simple mistakes** that are easy to make and hard to spot.

### Pitfall 1: SELECT *

```
Bad:   SELECT * FROM orders WHERE customer_id = 5;

Why it's slow:
  - Reads ALL columns, even if you only need 2
  - Prevents Index Only Scans (must access the table)
  - Transfers more data over the network
  - Breaks if table schema changes

Good:  SELECT order_date, total_amount FROM orders WHERE customer_id = 5;

       → Reads only needed columns
       → May enable Index Only Scan
       → Less data transferred
       → Explicit and maintainable
```

### Pitfall 2: Functions on Indexed Columns

```
Bad:   WHERE UPPER(email) = 'ALICE@EXAMPLE.COM'
       WHERE DATE_TRUNC('month', order_date) = '2024-01-01'
       WHERE CAST(id AS text) = '42'

Why: The function is applied to EVERY row before comparison.
     The index stores raw values, not function results.
     → Full table scan instead of index lookup.

Good:  WHERE email = 'alice@example.com'             (case-sensitive match)
       WHERE order_date >= '2024-01-01'              (range on raw column)
         AND order_date < '2024-02-01'
       WHERE id = 42                                 (match the column type)

Or:    CREATE INDEX idx ON customers (UPPER(email)); (expression index)
```

### Pitfall 3: Implicit Type Casts

```
Bad:   WHERE id = '42'
       ↑ id is integer, '42' is text
       PostgreSQL may cast EVERY row's id to text for comparison
       → Index on id becomes useless

Good:  WHERE id = 42
       ↑ Types match → index used directly

Check: EXPLAIN ANALYZE will show a Seq Scan when types mismatch
```

### Pitfall 4: Large OFFSET Pagination

```
Bad:   SELECT * FROM orders ORDER BY order_date LIMIT 20 OFFSET 10000;

Why:   The database must:
       1. Sort ALL rows
       2. Skip the first 10,000
       3. Return 20
       → Work grows linearly with OFFSET

       OFFSET 100    → skip 100 rows
       OFFSET 10000  → skip 10,000 rows (50x more work)
       OFFSET 100000 → skip 100,000 rows (500x more work)

Good:  Keyset pagination (cursor-based):
       SELECT * FROM orders
       WHERE order_date > '2024-06-15'  -- last seen date
       ORDER BY order_date
       LIMIT 20;

       → Always reads only 20 rows, regardless of "page number"
       → Requires remembering the last seen value
```

### Pitfall 5: N+1 Query Pattern

```
Bad (application code):
  customers = query("SELECT * FROM customers")
  for customer in customers:
      orders = query("SELECT * FROM orders WHERE customer_id = ?", customer.id)
      # 1 query for customers + N queries for orders = N+1 queries

Why:   20 customers = 21 queries. 1000 customers = 1001 queries.
       Each query has network + planning + execution overhead.

Good:  Single query with JOIN:
       SELECT c.*, o.order_date, o.total_amount
       FROM customers c
       JOIN orders o ON o.customer_id = c.id;
       → 1 query instead of N+1
```

### Pitfall 6: Missing WHERE on Large Tables

```
Bad:   SELECT COUNT(*) FROM orders;
       → Scans the ENTIRE table

       In production with millions of rows, this can take seconds.

Better: If you need approximate count:
       SELECT reltuples::bigint AS estimate
       FROM pg_class WHERE relname = 'orders';
       → Instant (reads from statistics, not the table)

Better: If you need exact count with conditions:
       SELECT COUNT(*) FROM orders WHERE status = 'pending';
       → With an index on status, much faster than counting all
```

### Pitfall 7: Over-Indexing

```
Table with 6 columns and 10 indexes:

  INSERT one row → update 10 index entries
  UPDATE one row → update affected indexes
  DELETE one row → mark 10 index entries for cleanup

Signs of over-indexing:
  - Indexes larger than the table
  - Duplicate indexes (same columns, different names)
  - Indexes on columns never filtered or sorted
  - Indexes on low-cardinality columns (e.g., boolean)

Check for unused indexes:
  SELECT schemaname, relname, indexrelname, idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0
  ORDER BY pg_relation_size(indexrelid) DESC;
  → Shows indexes that have NEVER been used (waste of space + write overhead)
```

### Pitfall Summary

```
Pitfall                    Fix
──────────────────────    ────────────────────────────────
SELECT *                   List specific columns
Function on indexed col    Use raw column or expression index
Type mismatch in WHERE     Match parameter types to column types
Large OFFSET               Use keyset/cursor pagination
N+1 queries                Use JOINs or batch queries
No WHERE on large table    Add filters; use estimates for counts
Over-indexing              Audit unused indexes regularly
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `products` — id, name, category_id, price, stock_quantity, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price

## Step-by-Step Reasoning

1. **Start with EXPLAIN ANALYZE** → See what the database actually does.
2. **Look for Seq Scans** → On tables that should use indexes.
3. **Check estimated vs actual rows** → Large mismatch = stale statistics or bad query.
4. **Review WHERE clauses** → Are functions wrapping indexed columns?
5. **Check types** → Do parameter types match column types?
6. **Review OFFSET values** → Large offsets are slow; consider keyset pagination.

## Starter SQL

```sql
-- Compare SELECT * vs specific columns
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 1;

EXPLAIN ANALYZE SELECT order_date, status FROM orders WHERE customer_id = 1;
```

## Solution

```sql
-- Pitfall 1: SELECT * vs specific columns
-- Compare the width (bytes per row) in both plans
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 1;

EXPLAIN ANALYZE
SELECT order_date, total_amount FROM orders WHERE customer_id = 1;

-- Pitfall 2: Function on column prevents index use
-- Compare these two approaches
EXPLAIN ANALYZE
SELECT * FROM customers WHERE UPPER(last_name) = 'SMITH';

EXPLAIN ANALYZE
SELECT * FROM customers WHERE last_name = 'Smith';

-- Pitfall 4: Large OFFSET pagination problem
-- These both return 5 rows, but one does much more work
EXPLAIN ANALYZE
SELECT * FROM orders ORDER BY order_date LIMIT 5 OFFSET 0;

EXPLAIN ANALYZE
SELECT * FROM orders ORDER BY order_date LIMIT 5 OFFSET 40;

-- Keyset pagination: always efficient regardless of "page"
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE order_date > '2024-03-01'
ORDER BY order_date
LIMIT 5;

-- Pitfall 5: N+1 vs JOIN (show the efficient approach)
-- Instead of querying orders per customer in a loop:
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_amount), 0) AS total_spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY total_spent DESC;

-- Pitfall 6: Check approximate row counts (instant)
SELECT
    relname AS table_name,
    reltuples::bigint AS estimated_rows
FROM pg_class
WHERE relname IN ('orders', 'customers', 'products', 'order_items')
ORDER BY reltuples DESC;

-- Pitfall 7: Find existing indexes and their sizes
SELECT
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(quote_ident(indexname)::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(quote_ident(indexname)::regclass) DESC;
```

The first pair shows that selecting specific columns reduces the "width" in the plan (fewer bytes per row).

The second pair demonstrates how wrapping a column in `UPPER()` forces a sequential scan even if the column has an index.

The third set shows the OFFSET problem: with our small dataset the difference is negligible, but with millions of rows, OFFSET 1000000 would be very slow. Keyset pagination stays fast regardless of how deep you paginate.

The fifth query replaces the N+1 pattern with a single JOIN + GROUP BY — one query instead of one per customer.

The last two queries are diagnostic: check estimated row counts and index sizes to understand your database's current state.

## Alternative Solutions

For monitoring query performance in production, PostgreSQL has the `pg_stat_statements` extension:

```sql
-- Enable the extension (requires superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries (once extension is enabled)
-- SELECT query, calls, mean_exec_time, total_exec_time
-- FROM pg_stat_statements
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;
```

This tracks all queries and their cumulative execution statistics — invaluable for finding real performance bottlenecks in production.

Another approach for pagination is using `ROW_NUMBER()`:

```sql
-- Window-based pagination (still needs to compute all row numbers)
WITH numbered AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY order_date) AS rn
    FROM orders
)
SELECT * FROM numbered WHERE rn BETWEEN 41 AND 45;
```

This is more flexible than OFFSET but has similar performance characteristics. Keyset pagination remains the best option for deep pagination.
