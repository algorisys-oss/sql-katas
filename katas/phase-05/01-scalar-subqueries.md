---
id: scalar-subqueries
phase: 5
phase_title: Subqueries & CTEs
sequence: 1
title: Scalar Subqueries
---

## Description

### Queries Inside Queries

A **subquery** is a `SELECT` statement nested inside another SQL statement. Subqueries let you break complex problems into smaller, composable pieces.

A **scalar subquery** is a subquery that returns exactly **one row and one column** — a single value. You can use it anywhere a single value is expected: in `SELECT`, `WHERE`, `HAVING`, or even in mathematical expressions.

### Scalar Subqueries in WHERE

The most common use: compare a column against a computed value.

```sql
-- Products priced above the average
SELECT name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products);
```

The subquery `(SELECT AVG(price) FROM products)` executes first, returns a single number (e.g., 99.50), and then the outer query uses that number in the comparison.

This is equivalent to computing the average manually and hardcoding it:

```sql
-- Same idea, but fragile (hardcoded threshold)
SELECT name, price FROM products WHERE price > 99.50;
```

The subquery version stays correct even as prices change.

### Scalar Subqueries in SELECT

You can compute a value per-row using a scalar subquery in the `SELECT` clause:

```sql
SELECT
    name,
    price,
    (SELECT AVG(price) FROM products) AS avg_price,
    price - (SELECT AVG(price) FROM products) AS diff_from_avg
FROM products
ORDER BY diff_from_avg DESC;
```

Each row gets the same average value because the subquery does not reference the outer row. This is a simple (non-correlated) scalar subquery.

### Scalar Subqueries with Conditions

Scalar subqueries can have their own `WHERE` clauses:

```sql
-- Orders larger than the average delivered order
SELECT id, order_date, total_amount
FROM orders
WHERE total_amount > (
    SELECT AVG(total_amount)
    FROM orders
    WHERE status = 'delivered'
)
ORDER BY total_amount DESC;
```

The inner query computes the average of *delivered* orders only. The outer query uses that threshold to filter *all* orders.

### Visualizing Scalar Subquery Execution

Let's trace how the database processes a scalar subquery step by step:

```
Query: SELECT name, price FROM products WHERE price > (SELECT AVG(price) FROM products);

Step 1 — Execute inner query:
┌─────────────────────────────────────────┐
│ SELECT AVG(price) FROM products         │
│                                         │
│ All products: 14.99, 24.99, 34.99, ...  │
│ Result: 99.50                           │
└─────────────────────────────────────────┘

Step 2 — Substitute into outer query:
┌─────────────────────────────────────────┐
│ SELECT name, price                      │
│ FROM products                           │
│ WHERE price > 99.50    ← single value   │
└─────────────────────────────────────────┘

Step 3 — Execute outer query:
┌──────────────────────────────┬─────────┐
│ name                         │ price   │
├──────────────────────────────┼─────────┤
│ 27-inch 4K Monitor           │ 449.99  │
│ Ergonomic Office Chair       │ 349.99  │
│ Robot Vacuum Cleaner         │ 299.99  │
│ Adjustable Dumbbells Set     │ 249.99  │
│ ...                          │ ...     │
└──────────────────────────────┴─────────┘
```

The inner query produces **one value**. The outer query uses it like a constant.

### Scalar Subquery in SELECT — Row by Row

```
Query: SELECT name, price, (SELECT AVG(price) FROM products) AS avg_price FROM products;

The subquery returns 99.50 (computed once), then each row gets that value:

┌─────────────────────────┬────────┬───────────┐
│ name                    │ price  │ avg_price  │
├─────────────────────────┼────────┼───────────┤
│ Bluetooth Headphones    │  79.99 │     99.50  │
│ USB-C Cable 3-Pack      │  14.99 │     99.50  │  ← same value
│ Mechanical Keyboard     │ 129.99 │     99.50  │  ← every row
│ ...                     │    ... │     99.50  │
└─────────────────────────┴────────┴───────────┘
```

### Rules for Scalar Subqueries

1. **Must return exactly one value** — if the subquery returns multiple rows, SQL throws an error
2. **Must return exactly one column** — selecting multiple columns in a scalar subquery is an error
3. **Can reference the outer query** (correlated) or not (non-correlated)
4. **Executes before or during the outer query** — the optimizer decides the actual execution strategy

If there is any risk of the subquery returning more than one row, use `LIMIT 1` or an aggregate function to guarantee a single value.

### Scalar Subqueries vs JOIN

Some scalar subquery patterns can be rewritten as joins. Compare:

```sql
-- Subquery approach
SELECT
    name,
    price,
    (SELECT AVG(price) FROM products) AS avg_price
FROM products;

-- No join equivalent needed — this is a global value
-- But for per-group values, joins or window functions are better
```

For simple global values (overall average, max, count), scalar subqueries are clean and readable. For per-row computations that depend on related tables, joins or window functions (Phase 7) are usually more efficient.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Identify the single value you need** — an average, a max, a count, a specific row's value.
2. **Write the inner query first** — make sure it returns exactly one value.
3. **Test the inner query alone** — run it to verify the result.
4. **Plug it into the outer query** — use it in `WHERE`, `SELECT`, or `HAVING`.

## Starter SQL

```sql
-- Products priced above average
SELECT name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;
```

## Solution

```sql
-- Products above the overall average price
SELECT
    name,
    price,
    ROUND((SELECT AVG(price) FROM products), 2) AS avg_price,
    ROUND(price - (SELECT AVG(price) FROM products), 2) AS above_avg_by
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;

-- The most recent order
SELECT id, customer_id, order_date, total_amount
FROM orders
WHERE order_date = (SELECT MAX(order_date) FROM orders);

-- Customers who placed the most expensive order
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.total_amount
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.total_amount = (SELECT MAX(total_amount) FROM orders);

-- Orders worth more than the average for their status
-- (uses the same status filter in inner and outer)
SELECT id, customer_id, order_date, status, total_amount
FROM orders o
WHERE total_amount > (
    SELECT AVG(total_amount)
    FROM orders
    WHERE status = o.status
)
ORDER BY status, total_amount DESC;

-- Product count comparison: how does each category compare to overall?
SELECT
    p.category_id,
    COUNT(*) AS category_count,
    (SELECT COUNT(*) FROM products) AS total_products,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM products) * 100, 1) AS pct_of_total
FROM products p
GROUP BY p.category_id
ORDER BY category_count DESC;
```

The first query uses the same scalar subquery in three places: `SELECT` (to show the average), a computed column (to show the difference), and `WHERE` (to filter). The optimizer typically evaluates it once.

The second query finds the most recent order by comparing `order_date` to the max. This works because `MAX(order_date)` returns a single value.

The third query combines a scalar subquery with a join to show the customer who placed the largest order.

The fourth query is **correlated** — the inner query references `o.status` from the outer query. It computes the average separately for each status group. This is a preview of correlated subqueries (next kata).

The fifth query shows scalar subqueries in a `GROUP BY` context. The total product count is computed once and used to calculate each category's percentage.

## Alternative Solutions

Window functions (Phase 7) often replace scalar subqueries more elegantly:

```sql
-- Using a window function instead of scalar subquery
SELECT
    name,
    price,
    ROUND(AVG(price) OVER (), 2) AS avg_price,
    ROUND(price - AVG(price) OVER (), 2) AS above_avg_by
FROM products
ORDER BY price DESC;
```

`AVG(price) OVER ()` computes the average across all rows without collapsing them — no subquery needed. This is typically more efficient because it avoids re-executing the subquery.

For now, scalar subqueries are the right tool. Window functions will replace many of these patterns in Phase 7.
