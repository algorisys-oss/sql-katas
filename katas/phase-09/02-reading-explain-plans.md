---
id: reading-explain-plans
phase: 9
phase_title: Query Execution & Performance Awareness
sequence: 2
title: Reading EXPLAIN Plans
---

## Description

### How Queries Actually Execute

`EXPLAIN` reveals the database's execution plan — *how* it intends to retrieve your data. `EXPLAIN ANALYZE` actually runs the query and shows real-world timing.

```sql
-- Show the plan without executing
EXPLAIN SELECT * FROM orders WHERE status = 'delivered';

-- Show the plan AND execute (with actual timing)
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'delivered';
```

### Anatomy of an EXPLAIN Output

```
EXPLAIN output (simplified):

Seq Scan on orders  (cost=0.00..2.62 rows=17 width=44)
  Filter: (status = 'delivered')

Breaking it down:
┌─────────────────────────────────────────────────────┐
│ Node Type:   Seq Scan on orders                     │
│              ↑ Sequential scan = reads every row    │
│                                                     │
│ Cost:        0.00..2.62                             │
│              ↑ startup cost  ↑ total cost           │
│              (arbitrary units, not seconds)         │
│                                                     │
│ Rows:        17 (estimated rows returned)           │
│                                                     │
│ Width:       44 (estimated average row size, bytes) │
│                                                     │
│ Filter:      status = 'delivered'                   │
│              ↑ condition applied during scan        │
└─────────────────────────────────────────────────────┘
```

### EXPLAIN ANALYZE Adds Actual Numbers

```
EXPLAIN ANALYZE output:

Seq Scan on orders  (cost=0.00..2.62 rows=17 width=44)
                    (actual time=0.013..0.025 rows=15 loops=1)
  Filter: (status = 'delivered')
  Rows Removed by Filter: 35
Planning Time: 0.085 ms
Execution Time: 0.042 ms

New fields:
┌────────────────────────────────────────────────────┐
│ actual time:  0.013..0.025                         │
│               ↑ first row  ↑ last row (ms)         │
│                                                    │
│ rows:         15 (actual rows, vs 17 estimated)    │
│                                                    │
│ loops:        1 (how many times this node ran)     │
│                                                    │
│ Rows Removed: 35 (rows that didn't match filter)   │
│                                                    │
│ Planning:     0.085 ms (time to build the plan)    │
│ Execution:    0.042 ms (time to run the query)     │
└────────────────────────────────────────────────────┘
```

### Common Scan Types

```
Scan Type           When Used                    Speed
──────────────────  ─────────────────────────    ──────────────
Seq Scan            No useful index, or          Slowest (full
                    small table                  table read)

Index Scan          Index exists, selective      Fast (reads
                    filter                       index + table)

Index Only Scan     All needed columns are       Fastest (reads
                    in the index                 only the index)

Bitmap Index Scan   Multiple conditions, or      Medium (builds
  + Bitmap Heap     moderate selectivity         bitmap, then
    Scan                                         reads matching)
```

### Common Join Strategies

```
Join Type         Best For                  How It Works
────────────────  ────────────────────────  ──────────────────────
Nested Loop       Small outer table,        For each outer row,
                  indexed inner table       scan inner table

Hash Join         Large tables,             Build hash table from
                  equality joins            smaller table, probe
                                            with larger table

Merge Join        Pre-sorted data,          Walk both sorted inputs
                  equality joins            in parallel
```

### Reading a Multi-Node Plan

```
Plans are trees. Read from INSIDE OUT, BOTTOM to TOP:

Hash Join  (cost=1.25..4.50 rows=50 width=72)
  Hash Cond: (o.customer_id = c.id)
  →  Seq Scan on orders o  (cost=0.00..2.50 rows=50 width=44)
  →  Hash  (cost=1.00..1.00 rows=20 width=28)
       →  Seq Scan on customers c  (cost=0.00..1.00 rows=20 width=28)

Reading order:
  1. Seq Scan customers → load all 20 customers
  2. Hash → build hash table from customers
  3. Seq Scan orders → read all 50 orders
  4. Hash Join → match orders to customers via hash
```

### Key Metrics to Watch

| Metric | Healthy | Concern |
|--------|---------|---------|
| Estimated vs actual rows | Close match | 10x+ difference → stale statistics |
| Seq Scan on large table | Small table OK | Large table with selective filter → missing index |
| Nested Loop with Seq Scan | Small inner | Large inner table → need index |
| Sort with large row count | Small sorts OK | Large sorts → consider index for ORDER BY |

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `products` — id, name, category_id, price, stock_quantity, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price

## Step-by-Step Reasoning

1. **Start with EXPLAIN** → See the plan without running the query.
2. **Add ANALYZE** → Get actual timing and row counts.
3. **Read bottom-up** → Inner nodes execute first.
4. **Compare estimated vs actual rows** → Large discrepancies suggest stale stats.
5. **Look for Seq Scans** → On large tables with selective filters, these suggest missing indexes.

## Starter SQL

```sql
-- See the execution plan for a simple query
EXPLAIN SELECT * FROM orders WHERE status = 'delivered';
```

## Solution

```sql
-- Basic EXPLAIN: see the plan
EXPLAIN
SELECT * FROM orders WHERE status = 'delivered';

-- EXPLAIN ANALYZE: see plan + actual execution
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'delivered';

-- Join plan: see how the optimizer joins tables
EXPLAIN ANALYZE
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.total_amount > 50
ORDER BY o.order_date;

-- Aggregation plan: see GROUP BY execution
EXPLAIN ANALYZE
SELECT
    c.country,
    COUNT(*) AS order_count,
    ROUND(AVG(o.total_amount), 2) AS avg_amount
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.total_amount IS NOT NULL
GROUP BY c.country
ORDER BY order_count DESC;

-- Subquery plan: see how CTEs are executed
EXPLAIN ANALYZE
WITH customer_totals AS (
    SELECT
        customer_id,
        SUM(total_amount) AS total_spent
    FROM orders
    WHERE total_amount IS NOT NULL
    GROUP BY customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    ct.total_spent
FROM customer_totals ct
JOIN customers c ON c.id = ct.customer_id
ORDER BY ct.total_spent DESC;
```

The first two queries show the difference between EXPLAIN (plan only) and EXPLAIN ANALYZE (plan + actual execution metrics).

The third query shows a join plan — observe the join strategy (likely Hash Join or Nested Loop) and scan types.

The fourth query adds aggregation — look for Aggregate or HashAggregate nodes in the plan.

The fifth query uses a CTE — in PostgreSQL 12+, CTEs may be inlined (optimized away). Look for whether the CTE appears as a separate node or is merged into the main query.

## Alternative Solutions

Use `EXPLAIN (FORMAT JSON)` or `EXPLAIN (FORMAT YAML)` for machine-readable output:

```sql
-- JSON format: useful for programmatic analysis
EXPLAIN (FORMAT JSON, ANALYZE)
SELECT * FROM orders WHERE status = 'delivered';

-- Verbose format: shows output columns and more detail
EXPLAIN (VERBOSE, ANALYZE)
SELECT * FROM orders WHERE status = 'delivered';

-- Buffers: shows I/O information (cache hits vs disk reads)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE status = 'delivered';
```

The `BUFFERS` option is especially useful for understanding I/O patterns. `shared hit` means the data was in PostgreSQL's cache; `read` means it had to go to disk.
