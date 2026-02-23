---
id: order-by
phase: 1
phase_title: Basic SELECT
sequence: 3
title: ORDER BY
---

## Description

### Controlling Result Order

SQL tables have **no inherent order**. A table is a set of rows, and sets are unordered. Without `ORDER BY`, the database returns rows in whatever order it finds convenient — this order can change between queries, between database restarts, or between database versions.

**If you need a specific order, you must ask for it.**

### Sorting Direction

```sql
ORDER BY price ASC     -- ascending (default): 1, 2, 3, ...
ORDER BY price DESC    -- descending: 100, 99, 98, ...
```

`ASC` is the default. If you omit the direction, SQL sorts ascending.

### Multiple Sort Keys

You can sort by multiple columns. SQL sorts by the first column, then uses the second column to break ties:

```sql
ORDER BY country, city    -- sort by country first, then city within each country
ORDER BY price DESC, name ASC  -- most expensive first, alphabetical for same price
```

### Sorting NULLs

NULL values sort differently across databases. In PostgreSQL:
- `ASC`: NULLs sort **last** (after all non-NULL values)
- `DESC`: NULLs sort **first** (before all non-NULL values)

You can control this explicitly:
```sql
ORDER BY city NULLS FIRST
ORDER BY city NULLS LAST
```

### Sorting by Expressions

You can sort by computed expressions, not just column names:

```sql
ORDER BY price * stock_quantity DESC    -- sort by inventory value
ORDER BY LENGTH(name)                  -- sort by name length
ORDER BY EXTRACT(MONTH FROM order_date) -- sort by month
```

### Sorting by Position

You can reference columns by their position in the `SELECT` list:

```sql
SELECT name, price FROM products ORDER BY 2 DESC;
```

`ORDER BY 2` means "sort by the second selected column" (price). This is concise but less readable — prefer column names in production code.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `customers` — id, first_name, last_name, email, city, country, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at

## Step-by-Step Reasoning

1. **Identify what to sort by** — what column determines the order that answers your question?
2. **Choose direction** — do you want the highest first (DESC) or lowest first (ASC)?
3. **Handle ties** — if multiple rows share the same value in the first sort column, what should break the tie?
4. **Consider NULLs** — if the sort column has NULLs, where should they appear?

## Starter SQL

```sql
-- Most expensive products first
SELECT name, price
FROM products
ORDER BY price DESC;
```

## Solution

```sql
-- Multi-column sort: by country, then by city within country
SELECT first_name, last_name, city, country
FROM customers
ORDER BY country ASC, city ASC;

-- NULLs in sorting: customers without a city
SELECT first_name, last_name, city, country
FROM customers
ORDER BY city NULLS FIRST;

-- Sort by computed expression: inventory value
SELECT name, price, stock_quantity, price * stock_quantity AS inventory_value
FROM products
ORDER BY price * stock_quantity DESC;

-- Sort by date: most recent orders first
SELECT id, order_date, total_amount, status
FROM orders
ORDER BY order_date DESC
LIMIT 10;
```

The first query sorts customers by country alphabetically, then by city within each country. This groups customers geographically.

The second query demonstrates NULL handling. Customers with NULL city appear first — useful when you want to identify incomplete records.

The third query sorts by a computed value. Note that `ORDER BY` can reference the expression directly. You could also write `ORDER BY inventory_value` using the alias, since `ORDER BY` executes after `SELECT`.

The fourth query combines `ORDER BY` with `LIMIT` — a common pattern for "most recent N items."

## Alternative Solutions

PostgreSQL supports sorting by column alias and by position:

```sql
-- Sort by alias (works in PostgreSQL)
SELECT name, price * stock_quantity AS total_value
FROM products
ORDER BY total_value DESC;

-- Sort by position (less readable but concise)
SELECT name, price, stock_quantity
FROM products
ORDER BY 2 DESC, 3 DESC;
```

Position-based sorting (`ORDER BY 2`) is useful in `UNION` queries where the column names may differ between the parts. In regular queries, always prefer column names for clarity.

Important: the behavior of `ORDER BY` on aliases is database-specific. PostgreSQL and MySQL allow it; some other databases do not. When writing portable SQL, sort by the full expression or column name.
