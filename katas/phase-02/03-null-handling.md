---
id: null-handling
phase: 2
phase_title: Filtering & Conditions
sequence: 3
title: NULL Handling in Practice
---

## Description

### Building on Three-Valued Logic

Phase 0 introduced the theory of NULL and three-valued logic. This kata puts that theory into practice: how do you actually write queries that handle NULLs correctly?

### IS NULL and IS NOT NULL

The only way to test for NULL is with `IS NULL` and `IS NOT NULL`:

```sql
WHERE city IS NULL          -- rows where city is unknown
WHERE city IS NOT NULL      -- rows where city has a value
WHERE shipped_at IS NULL    -- unshipped orders
```

Never use `= NULL` or `!= NULL` — they always produce `unknown` and match nothing.

### COALESCE — Replace NULLs with Defaults

`COALESCE` returns the first non-NULL argument:

```sql
COALESCE(city, 'Unknown')              -- if city is NULL, use 'Unknown'
COALESCE(city, state, country, 'N/A')  -- first non-NULL from the list
```

Common uses:
- Display-friendly defaults: `COALESCE(city, '(not provided)')`
- Calculations where NULL would propagate: `COALESCE(discount, 0)`
- Fallback chains: `COALESCE(nickname, first_name, email)`

### NULLIF — Convert Values to NULL

`NULLIF(a, b)` returns NULL if `a = b`, otherwise returns `a`:

```sql
NULLIF(stock_quantity, 0)   -- returns NULL if stock is 0, else returns stock
```

The classic use case is preventing division by zero:

```sql
price / NULLIF(stock_quantity, 0)   -- NULL instead of error when stock is 0
```

Without `NULLIF`, dividing by zero raises an error. With `NULLIF`, dividing by zero produces NULL — a safe, queryable value.

### NULL in Boolean Logic: Practical Traps

**Trap 1: != does not find NULLs**

```sql
-- This does NOT return rows where city is NULL
SELECT * FROM customers WHERE city != 'Berlin';
```

If `city` is NULL, then `NULL != 'Berlin'` is `unknown`, and `WHERE` filters it out. To include NULLs:

```sql
WHERE city != 'Berlin' OR city IS NULL
WHERE city IS DISTINCT FROM 'Berlin'   -- PostgreSQL shorthand
```

**Trap 2: NOT IN with NULLs**

```sql
-- If any value in the list is NULL, NOT IN returns no rows
WHERE city NOT IN ('Berlin', NULL)   -- always returns zero rows!
```

**Trap 3: Aggregation ignores NULLs silently**

```sql
SELECT AVG(total_amount) FROM orders;  -- averages only non-NULL values
```

If 10 orders have amounts and 2 are NULL, `AVG` computes the average of 10 values, not 12.

### IS DISTINCT FROM — NULL-Safe Comparison

PostgreSQL provides `IS DISTINCT FROM` as a NULL-safe `!=`, and `IS NOT DISTINCT FROM` as a NULL-safe `=`:

```sql
WHERE city IS DISTINCT FROM 'Berlin'      -- true when city != 'Berlin' OR city IS NULL
WHERE city IS NOT DISTINCT FROM NULL       -- same as IS NULL
```

This operator treats NULL as a comparable value, eliminating the need for `OR IS NULL` workarounds.

## Schema Overview

- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `orders` — id, customer_id, order_date, total_amount (nullable), status, shipped_at (nullable)
- `products` — id, name, category_id, price, stock_quantity, created_at

## Step-by-Step Reasoning

1. **Identify nullable columns** — which columns in your query might be NULL?
2. **Check your comparisons** — are you using `= NULL` or `!= NULL` by mistake?
3. **Decide NULL behavior** — should NULLs be included, excluded, or replaced?
4. **Use the right tool** — `IS NULL`, `COALESCE`, `NULLIF`, or `IS DISTINCT FROM`?
5. **Test with NULL data** — always verify your query returns correct results for NULL rows.

## Starter SQL

```sql
-- Find customers with missing city
SELECT first_name, last_name, city, country
FROM customers
WHERE city IS NULL
ORDER BY last_name;
```

## Solution

```sql
-- Find unshipped orders (shipped_at is NULL)
SELECT id, order_date, total_amount, status, shipped_at
FROM orders
WHERE shipped_at IS NULL
ORDER BY order_date DESC
LIMIT 15;

-- COALESCE: display-friendly output
SELECT
    first_name,
    last_name,
    COALESCE(city, '(unknown)') AS city,
    country
FROM customers
ORDER BY country, last_name;

-- NULLIF: safe division
SELECT
    name,
    price,
    stock_quantity,
    NULLIF(stock_quantity, 0) AS safe_stock,
    ROUND(price / NULLIF(stock_quantity, 0), 2) AS price_per_unit
FROM products
ORDER BY stock_quantity ASC
LIMIT 15;

-- The != trap: this misses NULLs
SELECT first_name, last_name, city
FROM customers
WHERE city != 'Berlin'
ORDER BY last_name
LIMIT 10;

-- Fixed: include NULLs explicitly
SELECT first_name, last_name, city
FROM customers
WHERE city IS DISTINCT FROM 'Berlin'
ORDER BY last_name
LIMIT 10;

-- COALESCE in calculations: treat NULL amounts as 0
SELECT
    COUNT(*) AS total_orders,
    SUM(COALESCE(total_amount, 0)) AS total_revenue_with_nulls_as_zero,
    SUM(total_amount) AS total_revenue_ignoring_nulls,
    AVG(total_amount) AS avg_ignoring_nulls,
    AVG(COALESCE(total_amount, 0)) AS avg_with_nulls_as_zero
FROM orders;
```

The first query finds unshipped orders by checking `shipped_at IS NULL`. This is a real-world pattern: "find incomplete records."

`COALESCE` in the second query replaces NULL cities with a display string. The actual data is unchanged — only the query output differs.

`NULLIF` in the third query prevents division-by-zero errors. When `stock_quantity` is 0, `NULLIF(stock_quantity, 0)` returns NULL, making the division produce NULL instead of an error.

The fourth and fifth queries demonstrate the `!=` NULL trap. The fourth query misses all customers with NULL city. The fifth query uses `IS DISTINCT FROM` to include them.

The final query shows how `COALESCE` changes aggregation: `SUM(COALESCE(total_amount, 0))` treats NULLs as zero (increasing the denominator for averages), while `SUM(total_amount)` ignores NULLs entirely. Choose based on what makes sense for your business logic.

## Alternative Solutions

You can combine `IS NULL` checks with `OR` instead of using `IS DISTINCT FROM`:

```sql
-- These are equivalent
WHERE city IS DISTINCT FROM 'Berlin'
WHERE city != 'Berlin' OR city IS NULL
```

`IS DISTINCT FROM` is cleaner, but the `OR IS NULL` pattern works in all databases while `IS DISTINCT FROM` is PostgreSQL-specific.

For replacing NULLs in aggregation, you can also use `FILTER`:

```sql
SELECT
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE total_amount IS NOT NULL) AS orders_with_amount,
    COUNT(*) FILTER (WHERE total_amount IS NULL) AS orders_without_amount
FROM orders;
```

`FILTER` is a PostgreSQL extension that lets you apply conditions to individual aggregate functions. It is covered more in Phase 3.
