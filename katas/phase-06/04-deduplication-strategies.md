---
id: deduplication-strategies
phase: 6
phase_title: Advanced Filtering Patterns
sequence: 4
title: Deduplication Strategies
---

## Description

### Why Duplicates Appear

Duplicates arise from many sources:

- **Joins** that multiply rows (one-to-many, many-to-many)
- **Bad data** — the same record entered twice
- **Set operations** — `UNION ALL` preserving duplicates
- **Denormalized data** — repeated values by design

Knowing how to detect, analyze, and remove duplicates is a critical SQL skill.

### DISTINCT: The Simplest Tool

`DISTINCT` removes duplicate rows from the result:

```sql
-- Without DISTINCT: customer_id appears once per order
SELECT customer_id FROM orders;  -- 50 rows (one per order)

-- With DISTINCT: each customer_id appears once
SELECT DISTINCT customer_id FROM orders;  -- 20 rows (unique customers)
```

`DISTINCT` applies to the **entire row** — all columns must match for two rows to be considered duplicates.

```sql
-- DISTINCT on multiple columns
SELECT DISTINCT customer_id, status FROM orders ORDER BY customer_id;
-- Each unique (customer_id, status) pair appears once
```

### Detecting Duplicates with GROUP BY + HAVING

To find which values are duplicated and how many times:

```sql
-- Find customers with duplicate email addresses (if any)
SELECT email, COUNT(*) AS occurrences
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;
```

If this returns rows, you have duplicate emails. The `HAVING COUNT(*) > 1` filter keeps only groups with more than one row.

### Visualizing Deduplication

```
Raw data (after a join or from messy input):
┌────┬──────────┬────────────┐
│ id │ customer │ product    │
├────┼──────────┼────────────┤
│  1 │ Alice    │ Headphones │
│  1 │ Alice    │ Headphones │  ← exact duplicate
│  2 │ Alice    │ Keyboard   │
│  3 │ Bob      │ Headphones │
│  3 │ Bob      │ Headphones │  ← exact duplicate
└────┴──────────┴────────────┘

After DISTINCT:
┌────┬──────────┬────────────┐
│  1 │ Alice    │ Headphones │
│  2 │ Alice    │ Keyboard   │
│  3 │ Bob      │ Headphones │
└────┴──────────┴────────────┘

After DISTINCT ON (customer):  [PostgreSQL-specific]
┌────┬──────────┬────────────┐
│  1 │ Alice    │ Headphones │  ← first Alice row kept
│  3 │ Bob      │ Headphones │  ← first Bob row kept
└────┴──────────┴────────────┘
```

### DISTINCT ON (PostgreSQL-Specific)

Standard `DISTINCT` deduplicates entire rows. PostgreSQL's `DISTINCT ON` deduplicates based on **specific columns** while keeping the full row:

```sql
-- Keep only the most recent order per customer
SELECT DISTINCT ON (customer_id)
    customer_id,
    id AS order_id,
    order_date,
    total_amount,
    status
FROM orders
ORDER BY customer_id, order_date DESC;
```

How it works:
1. Sort by `customer_id`, then `order_date DESC` (newest first)
2. For each unique `customer_id`, keep only the **first row** (the most recent order)
3. Discard the rest

**The ORDER BY must start with the DISTINCT ON columns.** This determines which row is "first" within each group.

### ROW_NUMBER() for Deduplication

The most flexible deduplication tool is `ROW_NUMBER()` (a window function — preview from Phase 7):

```sql
-- Number rows within each customer group, ordered by date
WITH numbered AS (
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders
)
SELECT customer_id, id AS order_id, order_date, total_amount, status
FROM numbered
WHERE rn = 1
ORDER BY customer_id;
```

This is the **standard SQL approach** (works in all databases) and gives you full control over:
- Which column(s) define "same" (`PARTITION BY`)
- Which row to keep within each group (`ORDER BY`)

### Deduplication Patterns Summary

| Tool | Use Case | Standard SQL? |
|------|----------|---------------|
| `DISTINCT` | Remove exact duplicate rows | Yes |
| `DISTINCT ON (...)` | Keep first row per group | PostgreSQL only |
| `GROUP BY` + aggregates | Summarize duplicates | Yes |
| `ROW_NUMBER()` + filter | Keep one row per group with full control | Yes |
| `GROUP BY` + `HAVING COUNT > 1` | Find duplicates | Yes |

### Common Deduplication Mistakes

**Mistake 1: Using DISTINCT as a band-aid for bad joins**

```sql
-- WRONG approach: join causes duplicates, DISTINCT hides them
SELECT DISTINCT c.first_name, c.last_name
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id;

-- RIGHT approach: don't join tables you don't need
SELECT c.first_name, c.last_name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

If you find yourself adding `DISTINCT` to fix unexpected duplicates, the real problem is probably your joins.

**Mistake 2: DISTINCT in aggregate functions when not needed**

```sql
-- COUNT(DISTINCT ...) is correct here: count unique products per order
SELECT order_id, COUNT(DISTINCT product_id) AS unique_products
FROM order_items GROUP BY order_id;

-- COUNT(*) is correct here: count total items per order
SELECT order_id, COUNT(*) AS total_items
FROM order_items GROUP BY order_id;

-- WRONG: SUM(DISTINCT price) sums unique values, not unique rows
SELECT SUM(DISTINCT unit_price) FROM order_items;  -- probably not what you want
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Are you seeing unexpected duplicates?** — Check your joins first.
2. **Need exact row deduplication?** — `DISTINCT`.
3. **Need one row per group?** — `DISTINCT ON` (PostgreSQL) or `ROW_NUMBER()` (standard).
4. **Need to find duplicates?** — `GROUP BY` + `HAVING COUNT(*) > 1`.
5. **Need to count unique values?** — `COUNT(DISTINCT column)`.

## Starter SQL

```sql
-- Most recent order per customer using DISTINCT ON
SELECT DISTINCT ON (customer_id)
    customer_id,
    id AS order_id,
    order_date,
    status,
    total_amount
FROM orders
ORDER BY customer_id, order_date DESC;
```

## Solution

```sql
-- Find duplicate (customer_id, status) pairs
SELECT customer_id, status, COUNT(*) AS occurrences
FROM orders
GROUP BY customer_id, status
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;

-- Most recent order per customer (DISTINCT ON)
SELECT DISTINCT ON (customer_id)
    customer_id,
    id AS order_id,
    order_date,
    total_amount,
    status
FROM orders
ORDER BY customer_id, order_date DESC;

-- Most recent order per customer (ROW_NUMBER — standard SQL)
WITH ranked AS (
    SELECT
        customer_id,
        id AS order_id,
        order_date,
        total_amount,
        status,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders
)
SELECT customer_id, order_id, order_date, total_amount, status
FROM ranked
WHERE rn = 1
ORDER BY customer_id;

-- Unique countries with customer counts
SELECT DISTINCT country, COUNT(*) OVER (PARTITION BY country) AS customer_count
FROM customers
ORDER BY customer_count DESC;

-- Products appearing in the most orders (deduplicated count)
SELECT
    p.name,
    COUNT(DISTINCT oi.order_id) AS unique_orders,
    SUM(oi.quantity) AS total_units
FROM products p
JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name
ORDER BY unique_orders DESC
LIMIT 10;

-- First and last order per customer (aggregation-based dedup)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    MIN(o.order_date) AS first_order,
    MAX(o.order_date) AS last_order,
    COUNT(*) AS total_orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY first_order;
```

The first query detects duplicates: which (customer, status) combinations occur more than once. This is the diagnostic step.

The second and third queries show the same result using two approaches: PostgreSQL's `DISTINCT ON` vs standard SQL's `ROW_NUMBER()`. Both keep only the most recent order per customer. Run both and compare.

The fourth query uses `DISTINCT` with a window function to show unique countries alongside their customer count — no `GROUP BY` needed.

The fifth query uses `COUNT(DISTINCT oi.order_id)` to correctly count unique orders per product, even though the join may produce duplicate order references.

The sixth query uses `MIN`/`MAX` aggregation to collapse multiple orders per customer into a single summary row — a form of deduplication through aggregation.

## Alternative Solutions

For keeping the N most recent rows per group (not just one), use `ROW_NUMBER()` with a higher threshold:

```sql
-- Keep the 2 most recent orders per customer
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders
)
SELECT customer_id, id AS order_id, order_date, total_amount, status
FROM ranked
WHERE rn <= 2
ORDER BY customer_id, order_date DESC;
```

`DISTINCT ON` cannot do this — it only keeps the first row. `ROW_NUMBER()` is more flexible for "top N per group" problems (covered in depth in Phase 8).
