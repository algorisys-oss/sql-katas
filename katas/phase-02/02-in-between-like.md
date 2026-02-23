---
id: in-between-like
phase: 2
phase_title: Filtering & Conditions
sequence: 2
title: IN, BETWEEN & LIKE
---

## Description

### IN — Matching a List of Values

Instead of chaining multiple `OR` conditions on the same column, use `IN`:

```sql
-- Verbose
WHERE country = 'USA' OR country = 'Canada' OR country = 'Mexico'

-- Clean
WHERE country IN ('USA', 'Canada', 'Mexico')
```

`IN` checks whether a value matches **any** value in the list. It is purely syntactic sugar for multiple `OR` conditions — the database treats them identically.

`NOT IN` excludes rows matching any value in the list:

```sql
WHERE status NOT IN ('cancelled', 'returned')
```

**Warning:** `NOT IN` has a dangerous NULL trap. If the list contains a NULL, `NOT IN` returns no rows at all. This is because `value != NULL` produces `unknown`, and `AND unknown` propagates. Always ensure your `NOT IN` list contains no NULLs, or use `NOT EXISTS` instead (Phase 6).

### BETWEEN — Range Checks

`BETWEEN` is a shorthand for inclusive range checks:

```sql
-- These are equivalent
WHERE price BETWEEN 20 AND 100
WHERE price >= 20 AND price <= 100
```

`BETWEEN` is **inclusive** on both ends. `BETWEEN 20 AND 100` includes 20 and 100.

`NOT BETWEEN` excludes the range:

```sql
WHERE price NOT BETWEEN 20 AND 100  -- price < 20 OR price > 100
```

`BETWEEN` works on dates too:

```sql
WHERE order_date BETWEEN '2025-01-01' AND '2025-03-31'
```

**Caution with timestamps:** `BETWEEN '2025-01-01' AND '2025-01-31'` does NOT include times on January 31st after midnight if the column is a timestamp. For timestamp ranges, prefer `>= AND <`:

```sql
WHERE order_date >= '2025-01-01' AND order_date < '2025-02-01'
```

### LIKE — Pattern Matching

`LIKE` matches strings against a pattern with two wildcards:

| Wildcard | Meaning |
|---|---|
| `%` | Any sequence of characters (including empty) |
| `_` | Exactly one character |

```sql
WHERE name LIKE 'Pro%'       -- starts with 'Pro': 'Product', 'Professional', 'Pro'
WHERE email LIKE '%@gmail.com'  -- ends with @gmail.com
WHERE name LIKE '%phone%'    -- contains 'phone' anywhere
WHERE name LIKE '____'       -- exactly 4 characters
WHERE name LIKE 'P_o%'       -- 'P', any char, 'o', then anything
```

`LIKE` is **case-sensitive** in PostgreSQL. For case-insensitive matching, use `ILIKE`:

```sql
WHERE name ILIKE '%phone%'   -- matches 'Phone', 'PHONE', 'phone'
```

`NOT LIKE` excludes matches:

```sql
WHERE email NOT LIKE '%@test.com'
```

### Performance Note

`LIKE` patterns that start with `%` (e.g., `'%phone%'`) cannot use indexes and will scan the entire table. Patterns that start with a literal (e.g., `'Pro%'`) can use indexes efficiently. For full-text search on large datasets, PostgreSQL offers dedicated full-text search features.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `customers` — id, first_name, last_name, email, city, country, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at

## Step-by-Step Reasoning

1. **Multiple values on the same column?** → Use `IN` instead of chaining `OR`.
2. **Inclusive range?** → Use `BETWEEN` for clarity, or `>= AND <=` explicitly.
3. **Partial string match?** → Use `LIKE` with `%` and `_` wildcards.
4. **Case-insensitive?** → Use `ILIKE` instead of `LIKE`.
5. **Watch for NULLs** — `NOT IN` with NULLs in the list is a common trap.

## Starter SQL

```sql
-- Customers from North America
SELECT first_name, last_name, country
FROM customers
WHERE country IN ('USA', 'Canada', 'Mexico')
ORDER BY country, last_name;
```

## Solution

```sql
-- IN: customers from specific countries
SELECT first_name, last_name, city, country
FROM customers
WHERE country IN ('USA', 'Canada', 'UK')
ORDER BY country, last_name;

-- NOT IN: orders that are not cancelled or returned
SELECT id, order_date, total_amount, status
FROM orders
WHERE status NOT IN ('cancelled')
ORDER BY order_date DESC
LIMIT 15;

-- BETWEEN: products in a price range
SELECT name, price
FROM products
WHERE price BETWEEN 25 AND 75
ORDER BY price;

-- BETWEEN with dates: orders in Q1 2025
SELECT id, order_date, total_amount, status
FROM orders
WHERE order_date BETWEEN '2025-01-01' AND '2025-03-31'
ORDER BY order_date;

-- LIKE: products with names containing a pattern
SELECT name, price
FROM products
WHERE name LIKE '%Pro%'
ORDER BY name;

-- ILIKE: case-insensitive search
SELECT first_name, last_name, email
FROM customers
WHERE email ILIKE '%gmail%'
ORDER BY last_name;

-- Combining: expensive products from specific categories matching a pattern
SELECT name, price, category_id
FROM products
WHERE category_id IN (1, 2, 3)
  AND price BETWEEN 50 AND 200
  AND name ILIKE '%pro%'
ORDER BY price DESC;
```

The first query demonstrates `IN` as a clean alternative to multiple `OR` conditions. It reads naturally: "customers where country is in this list."

`NOT IN` in the second query excludes specific statuses. Be careful: if the list ever contains NULL, the entire `NOT IN` returns no rows.

The `BETWEEN` queries show inclusive range filtering for both numbers and dates. The date range `BETWEEN '2025-01-01' AND '2025-03-31'` includes both boundary dates.

The `LIKE` query searches for products with "Pro" in their name. The `%` on both sides means "Pro" can appear anywhere in the name.

`ILIKE` in the sixth query performs case-insensitive matching — essential for searching user-entered data like emails where casing varies.

The final query combines all three operators: `IN` for category selection, `BETWEEN` for price range, and `ILIKE` for pattern matching.

## Alternative Solutions

PostgreSQL supports regular expressions for advanced pattern matching:

```sql
-- ~ is the regex match operator (case-sensitive)
SELECT name, price
FROM products
WHERE name ~ '^(Pro|Smart)'
ORDER BY name;

-- ~* is the case-insensitive regex match
SELECT name, price
FROM products
WHERE name ~* 'phone|tablet|laptop'
ORDER BY name;
```

Regular expressions are more powerful than `LIKE` but harder to read and cannot use standard indexes. Use `LIKE`/`ILIKE` for simple patterns and regex only when wildcards are insufficient.

For `IN` with a subquery (checking against dynamic values from another table):

```sql
-- Products in categories that have 'Electronics' in their name
SELECT name, price
FROM products
WHERE category_id IN (
    SELECT id FROM categories WHERE name ILIKE '%electronics%'
);
```

This subquery pattern is covered in depth in Phase 5.
