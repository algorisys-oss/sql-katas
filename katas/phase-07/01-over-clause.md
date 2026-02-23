---
id: over-clause
phase: 7
phase_title: Window Functions
sequence: 1
title: The OVER() Clause
---

## Description

### A New Way to Think About Rows

Everything you have learned so far follows one pattern: either you return individual rows (SELECT, WHERE, JOIN) or you collapse rows into groups (GROUP BY, aggregate functions). There is nothing in between.

**Window functions** break this limitation. They let you compute values **across related rows** while keeping every individual row in the result.

```sql
SELECT
    name,
    price,
    AVG(price) OVER () AS avg_price
FROM products;
```

This returns **every product row** — but each row also includes the overall average price. No GROUP BY, no collapsing.

### The OVER() Clause

The `OVER()` clause is what makes a function a **window function**. It defines the "window" of rows that the function operates on.

```sql
-- Regular aggregate: collapses all rows into one
SELECT AVG(price) FROM products;  -- 1 row

-- Window function: computes across rows, keeps all rows
SELECT name, price, AVG(price) OVER () AS avg_price FROM products;  -- 30 rows
```

`OVER ()` with empty parentheses means "the window is all rows in the result set."

### Visualizing Window Functions vs Aggregates

```
Regular aggregate (GROUP BY):
┌──────────┬────────┐       ┌───────────┐
│ product  │ price  │       │ avg_price │
├──────────┼────────┤  ───→ ├───────────┤
│ Widget A │  10.00 │       │     20.00 │  ← one row
│ Widget B │  20.00 │       └───────────┘
│ Widget C │  30.00 │
└──────────┴────────┘

Window function (OVER):
┌──────────┬────────┐       ┌──────────┬────────┬───────────┐
│ product  │ price  │       │ product  │ price  │ avg_price │
├──────────┼────────┤  ───→ ├──────────┼────────┼───────────┤
│ Widget A │  10.00 │       │ Widget A │  10.00 │     20.00 │
│ Widget B │  20.00 │       │ Widget B │  20.00 │     20.00 │  ← all rows kept
│ Widget C │  30.00 │       │ Widget C │  30.00 │     20.00 │
└──────────┴────────┘       └──────────┴────────┴───────────┘
```

The key insight: **window functions add columns without removing rows.**

### Any Aggregate Can Be a Window Function

Every aggregate function you already know works as a window function:

```sql
SELECT
    name,
    price,
    COUNT(*) OVER () AS total_products,
    SUM(price) OVER () AS total_price,
    AVG(price) OVER () AS avg_price,
    MIN(price) OVER () AS min_price,
    MAX(price) OVER () AS max_price
FROM products;
```

Each row gets the same global values — because `OVER ()` uses all rows as the window.

### Computing Row-Level Comparisons

This is where window functions become powerful — comparing each row to the aggregate:

```sql
SELECT
    name,
    price,
    ROUND(AVG(price) OVER (), 2) AS avg_price,
    ROUND(price - AVG(price) OVER (), 2) AS diff_from_avg,
    ROUND(price / SUM(price) OVER () * 100, 2) AS pct_of_total
FROM products
ORDER BY price DESC;
```

Each product now shows how it compares to the average and what percentage of total revenue it represents — without subqueries.

### Execution Order

Window functions execute **after** `WHERE`, `GROUP BY`, and `HAVING` — but **before** `ORDER BY` and `LIMIT`:

```
1. FROM
2. WHERE
3. GROUP BY
4. HAVING
5. ★ Window functions ★
6. SELECT (other expressions)
7. DISTINCT
8. ORDER BY
9. LIMIT
```

This means:
- Window functions see the filtered, grouped result set
- You **cannot** use window functions in `WHERE` or `HAVING`
- You **can** use them in `SELECT` and `ORDER BY`

To filter on a window function result, wrap it in a CTE or subquery:

```sql
-- WRONG: cannot use window function in WHERE
SELECT name, price, AVG(price) OVER () AS avg
FROM products WHERE price > AVG(price) OVER ();

-- CORRECT: use a CTE
WITH priced AS (
    SELECT name, price, AVG(price) OVER () AS avg_price
    FROM products
)
SELECT name, price, avg_price FROM priced WHERE price > avg_price;
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Do you need to keep all rows while computing a summary?** → Window function.
2. **What summary do you need?** → Use the same aggregate functions you already know.
3. **What is the window?** → `OVER ()` for all rows. Next katas cover `PARTITION BY` for groups.
4. **Need to filter on the result?** → Wrap in a CTE first.

## Starter SQL

```sql
-- Each product with the overall average price
SELECT
    name,
    price,
    ROUND(AVG(price) OVER (), 2) AS avg_price,
    ROUND(price - AVG(price) OVER (), 2) AS diff
FROM products
ORDER BY diff DESC;
```

## Solution

```sql
-- Products compared to global statistics
SELECT
    name,
    price,
    ROUND(AVG(price) OVER (), 2) AS avg_price,
    MIN(price) OVER () AS cheapest,
    MAX(price) OVER () AS most_expensive,
    ROUND(price / MAX(price) OVER () * 100, 1) AS pct_of_max
FROM products
ORDER BY price DESC;

-- Orders with running context
SELECT
    id,
    order_date,
    total_amount,
    COUNT(*) OVER () AS total_orders,
    ROUND(AVG(total_amount) OVER (), 2) AS avg_order,
    ROUND(total_amount - AVG(total_amount) OVER (), 2) AS diff_from_avg
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;

-- Products above average price (using CTE to filter)
WITH product_stats AS (
    SELECT
        name,
        price,
        category_id,
        ROUND(AVG(price) OVER (), 2) AS avg_price
    FROM products
)
SELECT name, price, avg_price
FROM product_stats
WHERE price > avg_price
ORDER BY price DESC;

-- Each customer's order count vs the average customer's order count
WITH customer_counts AS (
    SELECT
        customer_id,
        COUNT(*) AS order_count
    FROM orders
    GROUP BY customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    cc.order_count,
    ROUND(AVG(cc.order_count) OVER (), 1) AS avg_order_count,
    cc.order_count - ROUND(AVG(cc.order_count) OVER (), 1) AS diff
FROM customer_counts cc
JOIN customers c ON c.id = cc.customer_id
ORDER BY diff DESC;
```

The first query shows every product alongside global price statistics. Each row has the same `avg_price`, `cheapest`, and `most_expensive` — but the `pct_of_max` column makes each row unique.

The second query adds order-level context: each order shows the total count and average, plus how far it deviates from the average.

The third query demonstrates filtering on a window function result — you must use a CTE (or subquery) because `WHERE` executes before window functions.

The fourth query combines GROUP BY with window functions: first aggregate orders per customer, then use a window function to compare each customer's count to the average.

## Alternative Solutions

Before window functions, you would use scalar subqueries or self-joins for row-level comparisons:

```sql
-- Scalar subquery approach (pre-window-function era)
SELECT
    name,
    price,
    (SELECT ROUND(AVG(price), 2) FROM products) AS avg_price,
    ROUND(price - (SELECT AVG(price) FROM products), 2) AS diff
FROM products
ORDER BY diff DESC;
```

The window function approach is cleaner and more efficient — the aggregate is computed once and applied to every row, rather than executing a subquery.

Window functions are also composable — you can have multiple window functions in the same query, each computing a different metric, without additional subqueries.
