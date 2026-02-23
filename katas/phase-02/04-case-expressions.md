---
id: case-expressions
phase: 2
phase_title: Filtering & Conditions
sequence: 4
title: CASE Expressions
---

## Description

### Conditional Logic in SQL

`CASE` is SQL's way of expressing if/else logic **inside a query**. It does not change data — it produces a new value for each row based on conditions.

### Simple CASE

Compares one expression against multiple values:

```sql
CASE status
    WHEN 'pending'    THEN 'Awaiting Processing'
    WHEN 'shipped'    THEN 'In Transit'
    WHEN 'delivered'  THEN 'Complete'
    ELSE 'Other'
END
```

This reads like a switch statement: "check `status` — if it equals 'pending', return 'Awaiting Processing', etc."

### Searched CASE

Evaluates arbitrary boolean expressions:

```sql
CASE
    WHEN price > 100 THEN 'Premium'
    WHEN price > 50  THEN 'Mid-range'
    WHEN price > 0   THEN 'Budget'
    ELSE 'Free'
END
```

Searched CASE is more flexible — each `WHEN` can test a different column or a complex condition.

**Order matters:** SQL evaluates `WHEN` clauses top to bottom and returns the first match. A product priced at $150 matches `price > 100` first and gets 'Premium' — it never reaches `price > 50`. Structure your conditions from most specific to least specific.

### CASE in Different Clauses

`CASE` can appear anywhere an expression is valid:

**In SELECT** (create computed columns):
```sql
SELECT name, CASE WHEN stock_quantity = 0 THEN 'Out of stock' ELSE 'Available' END AS availability
FROM products;
```

**In ORDER BY** (custom sort order):
```sql
ORDER BY CASE status
    WHEN 'pending' THEN 1
    WHEN 'shipped' THEN 2
    WHEN 'delivered' THEN 3
    ELSE 4
END
```

**In WHERE** (conditional filtering):
```sql
WHERE CASE WHEN category_id = 1 THEN price > 100 ELSE price > 50 END
```

**In aggregation** (conditional counting):
```sql
SELECT
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS delivered_count,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count
FROM orders;
```

### NULL and CASE

If no `WHEN` matches and there is no `ELSE`, `CASE` returns NULL. Always include `ELSE` unless you intentionally want NULL for unmatched rows.

```sql
CASE WHEN price > 100 THEN 'Expensive' END  -- returns NULL for prices <= 100
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at
- `customers` — id, first_name, last_name, email, city, country, created_at

## Step-by-Step Reasoning

1. **Identify the classification** — what categories or labels do you want to assign?
2. **Choose CASE type** — simple (one column, multiple values) or searched (complex conditions)?
3. **Order conditions correctly** — most specific first, catch-all `ELSE` at the end.
4. **Name the output** — use `AS` to give the computed column a meaningful alias.
5. **Handle NULLs** — include `ELSE` or verify that NULL is acceptable for unmatched rows.

## Starter SQL

```sql
-- Classify products by price tier
SELECT
    name,
    price,
    CASE
        WHEN price >= 100 THEN 'Premium'
        WHEN price >= 50  THEN 'Mid-range'
        ELSE 'Budget'
    END AS price_tier
FROM products
ORDER BY price DESC;
```

## Solution

```sql
-- Simple CASE: human-readable order status
SELECT
    id,
    order_date,
    total_amount,
    status,
    CASE status
        WHEN 'pending'    THEN 'Awaiting Processing'
        WHEN 'processing' THEN 'Being Prepared'
        WHEN 'shipped'    THEN 'In Transit'
        WHEN 'delivered'  THEN 'Complete'
        WHEN 'cancelled'  THEN 'Cancelled'
        ELSE status
    END AS status_label
FROM orders
ORDER BY order_date DESC
LIMIT 15;

-- Searched CASE: price tiers
SELECT
    name,
    price,
    CASE
        WHEN price >= 100 THEN 'Premium'
        WHEN price >= 50  THEN 'Mid-range'
        WHEN price >= 20  THEN 'Budget'
        ELSE 'Economy'
    END AS price_tier
FROM products
ORDER BY price DESC;

-- CASE for conditional counting (pivot-style)
SELECT
    COUNT(*) AS total_orders,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
    COUNT(CASE WHEN status = 'processing' THEN 1 END) AS processing,
    COUNT(CASE WHEN status = 'shipped' THEN 1 END) AS shipped,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS delivered,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled
FROM orders;

-- CASE in ORDER BY: custom status priority
SELECT id, order_date, status, total_amount
FROM orders
ORDER BY
    CASE status
        WHEN 'pending' THEN 1
        WHEN 'processing' THEN 2
        WHEN 'shipped' THEN 3
        WHEN 'delivered' THEN 4
        WHEN 'cancelled' THEN 5
    END,
    order_date DESC
LIMIT 20;

-- CASE with NULL handling
SELECT
    first_name,
    last_name,
    city,
    country,
    CASE
        WHEN city IS NOT NULL AND country IS NOT NULL THEN city || ', ' || country
        WHEN country IS NOT NULL THEN country
        ELSE '(location unknown)'
    END AS location
FROM customers
ORDER BY last_name;
```

The first query uses simple CASE to map status codes to human-readable labels. The `ELSE status` catch-all ensures unexpected values display as-is rather than NULL.

The second query uses searched CASE for numeric ranges. Conditions are ordered from highest to lowest — a $150 product matches `>= 100` first and stops. Reordering conditions would change results.

The third query is a powerful pattern: conditional counting. Each `COUNT(CASE ... END)` counts only rows matching that condition. The CASE returns 1 for matches and NULL for non-matches, and `COUNT` ignores NULLs. This creates a single-row summary of order statuses — a manual pivot.

The fourth query uses CASE in ORDER BY to define a custom sort order. Instead of alphabetical sorting (which would put 'cancelled' first), orders appear in logical workflow sequence.

The fifth query handles NULLs in string concatenation. Without the CASE, `city || ', ' || country` would produce NULL if either is NULL (because NULL propagates through concatenation).

## Alternative Solutions

PostgreSQL has shorthand for some CASE patterns:

```sql
-- COALESCE is a shorthand for a specific CASE pattern
-- These are equivalent:
COALESCE(city, '(unknown)')
CASE WHEN city IS NOT NULL THEN city ELSE '(unknown)' END

-- NULLIF is also shorthand:
NULLIF(stock_quantity, 0)
CASE WHEN stock_quantity = 0 THEN NULL ELSE stock_quantity END

-- PostgreSQL FILTER clause replaces CASE in aggregation:
SELECT
    COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders;
```

The `FILTER` clause (PostgreSQL-specific) is cleaner than `COUNT(CASE ...)` for conditional aggregation. However, the CASE approach works in all SQL databases, making it more portable.

For simple two-way conditions, some developers use boolean expressions directly:

```sql
SELECT
    name,
    (price >= 100)::text AS is_premium  -- PostgreSQL boolean cast
FROM products;
```

This returns 'true' or 'false' as text. CASE is more readable and flexible for anything beyond simple true/false.
