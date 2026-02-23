---
id: type-casting
phase: 2
phase_title: Filtering & Conditions
sequence: 5
title: Type Casting
---

## Description

### Why Types Matter

Every column in SQL has a data type: `integer`, `text`, `numeric`, `date`, `boolean`, `timestamp`, etc. When you compare or combine values, the types must be compatible.

Sometimes they are not, and you need to **cast** — convert a value from one type to another.

### Implicit vs Explicit Casting

**Implicit casting** happens automatically when the database can safely convert:

```sql
WHERE price > 50          -- 50 (integer) implicitly cast to numeric
WHERE order_date > '2025-01-01'  -- string implicitly cast to date
```

**Explicit casting** is required when the database cannot guess your intent:

```sql
SELECT '42'::integer              -- PostgreSQL shorthand
SELECT CAST('42' AS integer)      -- Standard SQL
```

### PostgreSQL Cast Syntax

PostgreSQL supports two syntaxes:

```sql
-- Double-colon syntax (PostgreSQL-specific, commonly used)
'2025-01-15'::date
'42.5'::numeric
price::text
created_at::date

-- CAST function (SQL standard, works everywhere)
CAST('2025-01-15' AS date)
CAST('42.5' AS numeric)
CAST(price AS text)
CAST(created_at AS date)
```

Both produce identical results. `::` is shorter and more common in PostgreSQL code; `CAST()` is portable.

### Common Casts

| From | To | Example | Use Case |
|---|---|---|---|
| text → integer | `'42'::integer` | Parsing string data |
| text → date | `'2025-01-15'::date` | Date comparisons |
| timestamp → date | `created_at::date` | Strip time from timestamp |
| numeric → integer | `price::integer` | Truncate decimals |
| integer → text | `id::text` | String concatenation |
| boolean → text | `true::text` | Display 'true'/'false' |

### Casting Timestamps to Dates

One of the most common casts: extracting just the date from a timestamp:

```sql
SELECT created_at, created_at::date AS created_date
FROM customers;
```

This is essential for grouping by day:

```sql
SELECT created_at::date AS day, COUNT(*) AS orders
FROM orders
GROUP BY created_at::date
ORDER BY day;
```

### Rounding and Truncation

When casting numeric to integer, PostgreSQL **rounds** (not truncates):

```sql
SELECT 4.5::integer;    -- 5 (rounds up)
SELECT 4.4::integer;    -- 4 (rounds down)
SELECT -4.5::integer;   -- -5 (rounds away from zero in some cases)
```

For explicit control, use `FLOOR()`, `CEIL()`, or `ROUND()` before casting.

### Cast Failures

Invalid casts raise errors:

```sql
SELECT 'hello'::integer;   -- ERROR: invalid input syntax for integer
SELECT '2025-13-01'::date;  -- ERROR: month 13 does not exist
```

There is no "safe cast" in standard SQL. If you need to handle potential failures, use pattern matching or `CASE` to validate before casting.

## Schema Overview

- `products` — id (integer), name (text), price (numeric), created_at (timestamp)
- `orders` — id (integer), order_date (date), total_amount (numeric), status (text)
- `customers` — id (integer), first_name (text), email (text), created_at (timestamp)

## Step-by-Step Reasoning

1. **Identify the type mismatch** — what types are you combining or comparing?
2. **Determine if implicit cast works** — the database may handle it automatically.
3. **Cast explicitly if needed** — use `::type` (PostgreSQL) or `CAST(... AS type)` (standard).
4. **Handle edge cases** — what happens with NULLs? What happens with invalid values?
5. **Choose the right target type** — `date` vs `timestamp`, `integer` vs `numeric`, etc.

## Starter SQL

```sql
-- Strip time from timestamps
SELECT
    first_name,
    last_name,
    created_at,
    created_at::date AS signup_date
FROM customers
ORDER BY signup_date DESC
LIMIT 10;
```

## Solution

```sql
-- Timestamp to date: when did customers sign up?
SELECT
    first_name,
    last_name,
    created_at,
    created_at::date AS signup_date
FROM customers
ORDER BY signup_date DESC
LIMIT 10;

-- Group orders by date (timestamp → date)
SELECT
    order_date::date AS day,
    COUNT(*) AS order_count,
    SUM(total_amount) AS daily_revenue
FROM orders
GROUP BY order_date::date
ORDER BY day DESC
LIMIT 15;

-- Numeric to integer: rounded prices
SELECT
    name,
    price,
    price::integer AS rounded_price,
    FLOOR(price)::integer AS floor_price,
    CEIL(price)::integer AS ceil_price
FROM products
ORDER BY price DESC
LIMIT 10;

-- Integer to text: for string concatenation
SELECT
    'Order #' || id::text AS order_label,
    order_date,
    '$' || ROUND(total_amount, 2)::text AS amount_display
FROM orders
ORDER BY order_date DESC
LIMIT 10;

-- Standard CAST syntax
SELECT
    name,
    CAST(price AS integer) AS int_price,
    CAST(created_at AS date) AS created_date
FROM products
ORDER BY created_date DESC
LIMIT 10;
```

The first query casts timestamps to dates for cleaner display. `created_at` might be `2025-03-15 14:30:22`, but `created_at::date` gives you just `2025-03-15`.

The second query demonstrates the most common use of date casting: grouping by day. Without the cast, each unique timestamp would be its own group, giving you one row per order instead of one row per day.

The third query shows numeric-to-integer casting with explicit rounding control. `price::integer` rounds, `FLOOR` always rounds down, `CEIL` always rounds up.

The fourth query casts integers to text for string concatenation. In PostgreSQL, you cannot concatenate `'Order #' || 42` directly — the integer must be cast to text first (though PostgreSQL often handles this implicitly in `||` concatenation).

The fifth query uses the SQL standard `CAST()` syntax, which is portable across databases.

## Alternative Solutions

PostgreSQL provides formatting functions that are often better than casting for display:

```sql
-- to_char: format numbers and dates as strings
SELECT
    name,
    to_char(price, 'FM$999,990.00') AS formatted_price,
    to_char(created_at, 'YYYY-MM-DD HH24:MI') AS formatted_date
FROM products
ORDER BY price DESC
LIMIT 10;

-- to_date and to_timestamp: parse strings with format patterns
SELECT to_date('15-Jan-2025', 'DD-Mon-YYYY');
SELECT to_timestamp('2025/01/15 14:30', 'YYYY/MM/DD HH24:MI');
```

`to_char` is more powerful than casting to text because it supports format patterns. Use casting for type conversions in logic; use `to_char` for formatted display output.

For safe casting (handling invalid values without errors), use a CASE-based approach:

```sql
-- Safe "cast" using CASE and pattern matching
SELECT
    value,
    CASE
        WHEN value ~ '^\d+$' THEN value::integer
        ELSE NULL
    END AS safe_int
FROM (VALUES ('42'), ('hello'), ('99'), ('')) AS t(value);
```

The `~` operator tests a regex pattern (`^\d+$` = digits only). This prevents cast errors on non-numeric strings.
