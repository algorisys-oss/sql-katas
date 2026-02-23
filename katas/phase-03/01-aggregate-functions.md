---
id: aggregate-functions
phase: 3
phase_title: Aggregation & GROUP BY
sequence: 1
title: Aggregate Functions
---

## Description

### From Rows to Single Values

So far, every query you have written returns individual rows — one output row for each input row that passes the `WHERE` filter. **Aggregate functions** change that: they take a set of rows and collapse them into a single summary value.

This is a fundamental shift in how SQL processes data.

The five core aggregate functions are:

| Function | Purpose | NULL Behavior |
|----------|---------|---------------|
| `COUNT(*)` | Count all rows | Counts every row, including NULLs |
| `COUNT(column)` | Count non-NULL values in a column | Skips NULL values |
| `SUM(column)` | Sum of all values | Ignores NULLs |
| `AVG(column)` | Arithmetic mean | Ignores NULLs (does NOT treat them as 0) |
| `MIN(column)` | Smallest value | Ignores NULLs |
| `MAX(column)` | Largest value | Ignores NULLs |

### COUNT(*) vs COUNT(column)

This is one of the most commonly misunderstood differences in SQL:

```sql
-- Counts ALL rows, regardless of NULLs
SELECT COUNT(*) FROM orders;

-- Counts only rows where total_amount is NOT NULL
SELECT COUNT(total_amount) FROM orders;
```

If your `orders` table has 50 rows, and 7 of them have `NULL` for `total_amount`, then:
- `COUNT(*)` returns **50**
- `COUNT(total_amount)` returns **43**

This distinction matters. When calculating averages or understanding data completeness, `COUNT(*)` vs `COUNT(column)` gives you different answers — and both are correct for different questions.

### AVG and the NULL Trap

`AVG` ignores NULLs entirely. It does **not** treat them as zero. This means:

```sql
-- If total_amount has values: 100, 200, NULL, 300
-- AVG(total_amount) = (100 + 200 + 300) / 3 = 200
-- NOT (100 + 200 + 0 + 300) / 4 = 150
```

If you **want** NULLs treated as zero, you must say so explicitly:

```sql
SELECT AVG(COALESCE(total_amount, 0)) FROM orders;
```

### DISTINCT Inside Aggregates

You can combine `DISTINCT` with aggregate functions to operate on unique values only:

```sql
-- How many different countries do our customers come from?
SELECT COUNT(DISTINCT country) FROM customers;

-- How many unique statuses exist in orders?
SELECT COUNT(DISTINCT status) FROM orders;
```

### Multiple Aggregates in One Query

You can compute several aggregates in a single query:

```sql
SELECT
    COUNT(*) AS total_orders,
    SUM(total_amount) AS revenue,
    AVG(total_amount) AS avg_order_value,
    MIN(total_amount) AS smallest_order,
    MAX(total_amount) AS largest_order
FROM orders
WHERE status = 'delivered';
```

This returns a **single row** with five columns — a summary of all delivered orders.

### The Shape Change

Before aggregation, your result set has many rows. After aggregation (without `GROUP BY`), you get exactly **one row**. This is important:

> Aggregation changes the *shape* of your data. You go from a set of rows to a single summary row.

You cannot mix aggregated and non-aggregated columns without `GROUP BY`. This query is **invalid**:

```sql
-- WRONG: name is not aggregated and not in GROUP BY
SELECT name, COUNT(*) FROM products;
```

SQL does not know which `name` to display alongside the count of all products. The next kata on `GROUP BY` solves this problem.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Identify the question** — are you counting, summing, averaging, or finding extremes?
2. **Choose the table** — which table has the data you need to aggregate?
3. **Filter first** — use `WHERE` to narrow to relevant rows before aggregating.
4. **Pick the right function** — `COUNT(*)` for row counts, `COUNT(column)` for non-NULL counts, `SUM`/`AVG`/`MIN`/`MAX` for numeric summaries.
5. **Watch for NULLs** — decide whether NULLs should be excluded (default) or treated as a specific value (use `COALESCE`).

## Starter SQL

```sql
-- How many products do we have, and what is the price range?
SELECT
    COUNT(*) AS total_products,
    MIN(price) AS cheapest,
    MAX(price) AS most_expensive,
    ROUND(AVG(price), 2) AS avg_price
FROM products;
```

## Solution

```sql
-- Basic counts: total orders vs orders with known amounts
SELECT
    COUNT(*) AS total_orders,
    COUNT(total_amount) AS orders_with_amount,
    COUNT(*) - COUNT(total_amount) AS orders_missing_amount
FROM orders;

-- Revenue summary for delivered orders
SELECT
    COUNT(*) AS delivered_count,
    SUM(total_amount) AS total_revenue,
    ROUND(AVG(total_amount), 2) AS avg_order_value,
    MIN(total_amount) AS smallest_order,
    MAX(total_amount) AS largest_order
FROM orders
WHERE status = 'delivered';

-- Product inventory overview
SELECT
    COUNT(*) AS total_products,
    SUM(stock_quantity) AS total_units_in_stock,
    SUM(price * stock_quantity) AS total_inventory_value,
    ROUND(AVG(price), 2) AS avg_price
FROM products;

-- Count distinct values
SELECT
    COUNT(DISTINCT country) AS countries,
    COUNT(DISTINCT city) AS known_cities,
    COUNT(*) - COUNT(city) AS customers_without_city
FROM customers;

-- AVG with COALESCE: treating NULL amounts as 0
SELECT
    ROUND(AVG(total_amount), 2) AS avg_excluding_nulls,
    ROUND(AVG(COALESCE(total_amount, 0)), 2) AS avg_treating_nulls_as_zero
FROM orders;
```

The first query demonstrates `COUNT(*)` vs `COUNT(column)` — the difference reveals how many orders have missing `total_amount` values.

The second query combines `WHERE` filtering with aggregation. Only delivered orders are summarized. The `ROUND` function keeps the average readable.

The third query shows that aggregate functions work with expressions, not just plain columns. `SUM(price * stock_quantity)` computes the total inventory value.

The fourth query uses `COUNT(DISTINCT ...)` to find unique values and the `COUNT(*) - COUNT(column)` pattern to count NULLs.

The fifth query highlights the critical difference: `AVG` ignoring NULLs vs explicitly treating them as zero with `COALESCE`.

## Alternative Solutions

You can use `FILTER` (PostgreSQL extension) to compute conditional aggregates in a single pass:

```sql
SELECT
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    SUM(total_amount) FILTER (WHERE status = 'delivered') AS delivered_revenue
FROM orders;
```

The `FILTER` clause is cleaner than the traditional `CASE` approach:

```sql
-- Equivalent using CASE (works in all SQL dialects)
SELECT
    COUNT(*) AS total_orders,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS delivered,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
    SUM(CASE WHEN status = 'delivered' THEN total_amount END) AS delivered_revenue
FROM orders;
```

Both produce the same result. `FILTER` is PostgreSQL-specific but more readable. The `CASE` approach is ANSI-SQL and works everywhere.
