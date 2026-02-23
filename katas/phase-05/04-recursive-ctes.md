---
id: recursive-ctes
phase: 5
phase_title: Subqueries & CTEs
sequence: 4
title: Recursive CTEs
---

## Description

### Queries That Reference Themselves

A **recursive CTE** is a CTE that references itself. It lets you traverse hierarchical or graph-like data — things like org charts, category trees, bill of materials, or threaded comments.

Regular SQL cannot follow chains of unknown depth. Recursive CTEs solve this by repeatedly executing a query until no new rows are produced.

### The Structure

Every recursive CTE has two parts:

```sql
WITH RECURSIVE cte_name AS (
    -- 1. Base case (anchor): the starting rows
    SELECT ... FROM ...
    WHERE ...

    UNION ALL

    -- 2. Recursive step: references cte_name to find the next level
    SELECT ... FROM ...
    JOIN cte_name ON ...
)
SELECT * FROM cte_name;
```

The `UNION ALL` combines the base case with each recursive step. The recursion stops when the recursive step returns zero rows.

### Visualizing Recursive Execution

```
WITH RECURSIVE hierarchy AS (
    -- Base case: root nodes
    SELECT id, name, parent_id, 1 AS depth
    FROM categories WHERE parent_id IS NULL

    UNION ALL

    -- Recursive step: find children
    SELECT c.id, c.name, c.parent_id, h.depth + 1
    FROM categories c
    JOIN hierarchy h ON h.id = c.parent_id
)
SELECT * FROM hierarchy;

Iteration 0 (base case):
┌────┬───────────────┬───────────┬───────┐
│ id │ name          │ parent_id │ depth │
├────┼───────────────┼───────────┼───────┤
│  1 │ Electronics   │ NULL      │     1 │
│  2 │ Clothing      │ NULL      │     1 │
└────┴───────────────┴───────────┴───────┘

Iteration 1 (join base rows with children):
┌────┬───────────────┬───────────┬───────┐
│ 10 │ Phones        │ 1         │     2 │
│ 11 │ Laptops       │ 1         │     2 │
│ 20 │ Men's Wear    │ 2         │     2 │
└────┴───────────────┴───────────┴───────┘

Iteration 2 (join iteration 1 with their children):
┌────┬───────────────┬───────────┬───────┐
│100 │ Smartphones   │ 10        │     3 │
│101 │ Feature Phones│ 10        │     3 │
└────┴───────────────┴───────────┴───────┘

Iteration 3: no more children → STOP

Final result: all rows from iterations 0 + 1 + 2 combined.
```

### Practical Example: Number Series

Recursive CTEs can generate sequences without needing a table:

```sql
-- Generate numbers 1 through 10
WITH RECURSIVE numbers AS (
    SELECT 1 AS n                   -- base case
    UNION ALL
    SELECT n + 1 FROM numbers       -- recursive step
    WHERE n < 10                    -- termination condition
)
SELECT n FROM numbers;
```

### Practical Example: Date Series

Generate a sequence of dates (useful for filling gaps in time-series data):

```sql
-- Generate every day in January 2024
WITH RECURSIVE dates AS (
    SELECT DATE '2024-01-01' AS d
    UNION ALL
    SELECT d + INTERVAL '1 day' FROM dates WHERE d < '2024-01-31'
)
SELECT d::date AS date FROM dates;
```

PostgreSQL also has `generate_series()` for this, but the recursive CTE pattern works in any SQL database.

### Practical Example: Order Chain

Our e-commerce schema does not have hierarchical data, but we can demonstrate recursive thinking with a simulated scenario — finding all customers who ordered the same products as a given customer (product-based recommendations):

```sql
-- Find products ordered by customer 1
WITH customer_products AS (
    SELECT DISTINCT oi.product_id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = 1
),
-- Find other customers who also ordered those products
related_customers AS (
    SELECT DISTINCT o.customer_id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.product_id IN (SELECT product_id FROM customer_products)
      AND o.customer_id != 1
)
SELECT
    c.first_name || ' ' || c.last_name AS related_customer,
    c.email
FROM related_customers rc
JOIN customers c ON c.id = rc.customer_id;
```

This is not recursive, but it shows the kind of graph traversal that recursive CTEs enable when relationships form chains or trees.

### Safeguarding Against Infinite Loops

Recursive CTEs can loop forever if the data has cycles or the termination condition is missing. Always include safeguards:

```sql
-- Add a depth limit to prevent infinite recursion
WITH RECURSIVE tree AS (
    SELECT id, name, parent_id, 1 AS depth
    FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.name, c.parent_id, t.depth + 1
    FROM categories c
    JOIN tree t ON t.id = c.parent_id
    WHERE t.depth < 10  -- safety limit
)
SELECT * FROM tree;
```

PostgreSQL also has a `CYCLE` clause (PG 14+) to detect and break cycles automatically:

```sql
WITH RECURSIVE tree AS (
    SELECT id, name, parent_id
    FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.name, c.parent_id
    FROM categories c
    JOIN tree t ON t.id = c.parent_id
) CYCLE id SET is_cycle USING path
SELECT * FROM tree WHERE NOT is_cycle;
```

### UNION vs UNION ALL in Recursive CTEs

- `UNION ALL` — includes all rows, even duplicates (faster, standard choice)
- `UNION` — deduplicates rows at each step (slower, but prevents cycles in graph traversal)

Use `UNION ALL` by default. Switch to `UNION` only when you need deduplication to break cycles.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Is the data hierarchical?** — parent-child, tree, or chain relationships → recursive CTE.
2. **Write the base case** — what are the starting rows? (roots, first level, initial values)
3. **Write the recursive step** — how do you find the next level from the current one?
4. **Add a termination condition** — depth limit or `WHERE` clause to stop recursion.
5. **Test with small data** — verify each level before running on the full dataset.

## Starter SQL

```sql
-- Generate a number series using recursive CTE
WITH RECURSIVE nums AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM nums WHERE n < 20
)
SELECT n FROM nums;
```

## Solution

```sql
-- Generate a date series for all months in 2024
WITH RECURSIVE months AS (
    SELECT DATE '2024-01-01' AS month_start
    UNION ALL
    SELECT (month_start + INTERVAL '1 month')::date
    FROM months
    WHERE month_start < '2024-12-01'
)
SELECT month_start, TO_CHAR(month_start, 'Month YYYY') AS label
FROM months;

-- Date series with order counts (fills gaps — months with no orders show 0)
WITH RECURSIVE months AS (
    SELECT DATE '2024-01-01' AS month_start
    UNION ALL
    SELECT (month_start + INTERVAL '1 month')::date
    FROM months
    WHERE month_start < '2024-12-01'
)
SELECT
    m.month_start,
    TO_CHAR(m.month_start, 'Mon YYYY') AS label,
    COUNT(o.id) AS order_count,
    COALESCE(ROUND(SUM(o.total_amount), 2), 0) AS revenue
FROM months m
LEFT JOIN orders o
    ON DATE_TRUNC('month', o.order_date)::date = m.month_start
GROUP BY m.month_start
ORDER BY m.month_start;

-- Fibonacci sequence (demonstrating recursive computation)
WITH RECURSIVE fib AS (
    SELECT 1 AS n, 1::bigint AS val, 0::bigint AS prev
    UNION ALL
    SELECT n + 1, val + prev, val
    FROM fib
    WHERE n < 20
)
SELECT n, val AS fibonacci FROM fib;

-- Cumulative customer acquisition by month
WITH RECURSIVE months AS (
    SELECT DATE '2024-01-01' AS month_start
    UNION ALL
    SELECT (month_start + INTERVAL '1 month')::date
    FROM months
    WHERE month_start < '2024-12-01'
),
monthly_new AS (
    SELECT
        DATE_TRUNC('month', created_at)::date AS month_start,
        COUNT(*) AS new_customers
    FROM customers
    GROUP BY DATE_TRUNC('month', created_at)
)
SELECT
    m.month_start,
    COALESCE(mn.new_customers, 0) AS new_customers,
    SUM(COALESCE(mn.new_customers, 0)) OVER (ORDER BY m.month_start) AS cumulative_total
FROM months m
LEFT JOIN monthly_new mn ON mn.month_start = m.month_start
ORDER BY m.month_start;
```

The first query generates all 12 months of 2024 as a date series. This is the foundation for time-series reports that need to show every period, even empty ones.

The second query joins the generated months with orders using a `LEFT JOIN`. Months with no orders show `0` instead of being absent. This is the standard "fill gaps in time series" pattern.

The third query demonstrates recursive computation: each row depends on the previous row's values. This is not practical for real reporting but illustrates how recursion builds on prior iterations.

The fourth query combines a recursive date series with window functions (`SUM OVER`) to show cumulative customer growth month by month.

## Alternative Solutions

PostgreSQL provides `generate_series()` as a built-in alternative to recursive date/number generation:

```sql
-- PostgreSQL-specific: generate_series for dates
SELECT d::date AS month_start
FROM generate_series('2024-01-01'::date, '2024-12-01'::date, '1 month') AS d;

-- PostgreSQL-specific: generate_series for numbers
SELECT n FROM generate_series(1, 20) AS n;
```

`generate_series()` is simpler and more efficient for PostgreSQL. Recursive CTEs are the portable, standard SQL approach that works in all major databases.

For true hierarchical data (org charts, category trees), PostgreSQL also offers the `ltree` extension for efficient tree operations. But recursive CTEs remain the standard, portable solution.
