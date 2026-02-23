---
id: null-and-three-valued-logic
phase: 0
phase_title: Relational Thinking
sequence: 5
title: NULL & Three-Valued Logic
---

## Description

### NULL is Not a Value

This is the single most important concept beginners get wrong about SQL.

**NULL does not mean zero. NULL does not mean empty string. NULL means unknown.**

When a customer's `city` is NULL, it does not mean they live in a city called "NULL" or that they have no city. It means **we do not know** their city. This distinction matters because it changes how every comparison, calculation, and aggregation works.

### Three-Valued Logic

Most programming languages use two-valued logic: expressions are either `true` or `false`. SQL uses **three-valued logic**: expressions can be `true`, `false`, or `unknown`.

Any comparison involving NULL produces `unknown`:

| Expression | Result |
|---|---|
| `NULL = NULL` | unknown (NOT true!) |
| `NULL != NULL` | unknown |
| `NULL > 5` | unknown |
| `NULL = 'hello'` | unknown |
| `1 = 1` | true |
| `1 = 2` | false |

This is why `WHERE city = NULL` **never returns any rows** — the comparison produces `unknown`, and `WHERE` only includes rows where the condition is `true`. You must use `IS NULL` instead.

### How NULL Affects Operations

**Comparisons:** Any comparison with NULL yields unknown. Use `IS NULL` and `IS NOT NULL` instead of `=` and `!=`.

**Arithmetic:** Any calculation with NULL produces NULL. `5 + NULL = NULL`. `NULL * 0 = NULL` (not 0!).

**String operations:** `'Hello' || NULL = NULL`. Concatenation with NULL produces NULL.

**Aggregation:** Most aggregate functions **ignore NULLs**:
- `COUNT(column)` counts non-NULL values. `COUNT(*)` counts all rows.
- `SUM`, `AVG`, `MIN`, `MAX` all ignore NULL values.
- This means `AVG(column)` is the average of non-NULL values, not the average treating NULLs as zero.

**Boolean logic with NULL:**

| AND | true | false | unknown |
|---|---|---|---|
| **true** | true | false | unknown |
| **false** | false | false | false |
| **unknown** | unknown | false | unknown |

| OR | true | false | unknown |
|---|---|---|---|
| **true** | true | true | true |
| **false** | true | false | unknown |
| **unknown** | true | unknown | unknown |

| NOT | |
|---|---|
| **true** | false |
| **false** | true |
| **unknown** | unknown |

### Handling NULLs in Practice

- **COALESCE(a, b, c)** — returns the first non-NULL value. `COALESCE(city, 'Unknown')` replaces NULL cities with `'Unknown'`.
- **NULLIF(a, b)** — returns NULL if `a = b`, otherwise returns `a`. Useful for avoiding division by zero: `x / NULLIF(y, 0)`.
- **IS DISTINCT FROM** — a NULL-safe comparison: `NULL IS DISTINCT FROM NULL` is `false` (they are not distinct). This treats NULL as a comparable value.

## Schema Overview

- `customers.city` — nullable, some customers have NULL city
- `orders.total_amount` — nullable, some orders have NULL total
- `orders.shipped_at` — nullable, unshipped orders have NULL shipped_at

## Step-by-Step Reasoning

1. **Find NULLs** — query customers and orders to see which rows have NULL values. These are real, intentional gaps in the data.

2. **Compare `= NULL` vs `IS NULL`** — try both and observe the difference. This is the most common SQL mistake.

3. **See NULL in aggregation** — compare `COUNT(*)` vs `COUNT(city)` to see how NULLs are handled.

4. **Use COALESCE** — replace NULLs with meaningful defaults for display purposes.

5. **Observe NULL arithmetic** — see what happens when you add or compare with NULL values.

## Starter SQL

```sql
-- Find customers with NULL city
SELECT id, first_name, last_name, city
FROM customers
WHERE city IS NULL;
```

## Solution

```sql
-- WRONG: this returns zero rows (= NULL never matches)
SELECT id, first_name, last_name, city
FROM customers
WHERE city = NULL;

-- RIGHT: use IS NULL
SELECT id, first_name, last_name, city
FROM customers
WHERE city IS NULL;

-- COUNT(*) vs COUNT(column) — the critical difference
SELECT
    COUNT(*) AS total_customers,
    COUNT(city) AS customers_with_city,
    COUNT(*) - COUNT(city) AS customers_without_city
FROM customers;

-- COALESCE replaces NULL with a default for display
SELECT
    first_name,
    last_name,
    COALESCE(city, '(unknown)') AS city,
    country
FROM customers
ORDER BY last_name;

-- NULL in aggregation: AVG ignores NULLs
SELECT
    COUNT(*) AS total_orders,
    COUNT(total_amount) AS orders_with_amount,
    AVG(total_amount) AS avg_amount_excluding_nulls,
    SUM(total_amount) / COUNT(*) AS avg_if_nulls_were_zero
FROM orders;

-- NULL arithmetic: any operation with NULL produces NULL
SELECT
    id,
    total_amount,
    total_amount + 10 AS plus_ten,
    total_amount * 0 AS times_zero
FROM orders
WHERE total_amount IS NULL OR id <= 5
ORDER BY id;
```

The first pair of queries demonstrates the fundamental mistake: `= NULL` never works because the comparison produces `unknown`, which `WHERE` filters out. You must use `IS NULL`.

`COUNT(*)` counts all rows. `COUNT(city)` counts only rows where `city` is not NULL. The difference tells you how many NULLs exist.

`COALESCE` is the standard way to display a fallback value. It does not change the stored data — it only affects the query result.

The AVG comparison shows a subtle trap: `AVG(total_amount)` computes the average of non-NULL values only. If you want to treat NULLs as zero, you must use `SUM(total_amount) / COUNT(*)` or `AVG(COALESCE(total_amount, 0))`.

The arithmetic example proves that `NULL * 0` is NULL (not 0) and `NULL + 10` is NULL (not 10). NULL propagates through every operation.

## Alternative Solutions

For more advanced NULL handling:

```sql
-- IS DISTINCT FROM: NULL-safe comparison
-- Regular = treats NULL as unknown; IS DISTINCT FROM treats NULL as a value
SELECT
    id, first_name, city,
    city IS DISTINCT FROM NULL AS has_city
FROM customers
ORDER BY has_city, last_name;

-- NULLIF: useful to prevent division by zero
-- Returns NULL when both arguments are equal
SELECT
    id,
    stock_quantity,
    NULLIF(stock_quantity, 0) AS stock_or_null,
    price / NULLIF(stock_quantity, 0) AS price_per_unit
FROM products
ORDER BY stock_quantity
LIMIT 15;
```

`IS DISTINCT FROM` is PostgreSQL's NULL-safe equality operator. Unlike `=`, it considers `NULL IS DISTINCT FROM NULL` to be `false` — meaning two NULLs are "the same." This is invaluable when comparing columns that might be NULL.

`NULLIF` converts a specific value to NULL. The classic use case is `NULLIF(denominator, 0)` — if the denominator is zero, it becomes NULL, and the division produces NULL instead of a division-by-zero error. This is defensive programming in SQL.
