---
id: full-join
phase: 4
phase_title: Joins & Relationships
sequence: 4
title: FULL JOIN
---

## Description

### Keeping Everything from Both Sides

`FULL JOIN` (also `FULL OUTER JOIN`) combines the behavior of `LEFT JOIN` and `RIGHT JOIN`: it keeps **all rows from both tables**, filling in NULLs where there is no match on either side.

```sql
SELECT
    c.name AS category,
    p.name AS product
FROM categories c
FULL JOIN products p ON p.category_id = c.id
ORDER BY c.name, p.name;
```

This returns:
- Categories with products (matched rows)
- Categories with **no** products (left-only rows, product columns are NULL)
- Products with **no** category (right-only rows, category columns are NULL — possible if `category_id` is NULL or the FK is not enforced)

### Comparing All Four Join Types

Consider two tables where some rows match and some do not:

| Join Type | Left-only rows | Matched rows | Right-only rows |
|-----------|---------------|--------------|-----------------|
| `INNER JOIN` | Excluded | Included | Excluded |
| `LEFT JOIN` | Included (NULLs on right) | Included | Excluded |
| `RIGHT JOIN` | Excluded | Included | Included (NULLs on left) |
| `FULL JOIN` | Included (NULLs on right) | Included | Included (NULLs on left) |

`FULL JOIN` is the most inclusive — nothing is lost.

### When FULL JOIN is Useful

`FULL JOIN` is less common than `INNER` or `LEFT` joins, but it is essential for:

**1. Data reconciliation** — comparing two datasets to find mismatches:

```sql
-- Compare expected vs actual data
SELECT
    COALESCE(a.id, b.id) AS item_id,
    a.value AS expected,
    b.value AS actual,
    CASE
        WHEN a.id IS NULL THEN 'Missing from expected'
        WHEN b.id IS NULL THEN 'Missing from actual'
        WHEN a.value != b.value THEN 'Value mismatch'
        ELSE 'Match'
    END AS status
FROM expected_data a
FULL JOIN actual_data b ON b.id = a.id;
```

**2. Combining non-overlapping datasets:**

```sql
-- All customers and all orders (even unmatched on either side)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.order_date
FROM customers c
FULL JOIN orders o ON o.customer_id = c.id
ORDER BY c.last_name NULLS LAST, o.order_date NULLS LAST;
```

**3. Finding rows unique to each side:**

```sql
-- Rows that exist in only one table (symmetric anti-join)
SELECT
    c.name AS category,
    p.name AS product
FROM categories c
FULL JOIN products p ON p.category_id = c.id
WHERE c.id IS NULL OR p.id IS NULL;
```

### FULL JOIN and NULLs

With `FULL JOIN`, you get NULLs from two different sources:
1. **NULLs from unmatched rows** — the join could not find a partner
2. **NULLs from the actual data** — the column is genuinely NULL

This can cause confusion. Use `COALESCE` or explicit checks to handle both cases:

```sql
SELECT
    COALESCE(c.name, '(no category)') AS category,
    COALESCE(p.name, '(no product)') AS product
FROM categories c
FULL JOIN products p ON p.category_id = c.id
ORDER BY category, product;
```

### Performance Note

`FULL JOIN` typically requires more work than `INNER` or `LEFT JOIN` because the database must track unmatched rows from **both** sides. Use it when you genuinely need completeness from both tables — not as a default.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)

## Step-by-Step Reasoning

1. **Do you need all rows from both tables?** — Use `FULL JOIN`.
2. **Do you need only all rows from one table?** — Use `LEFT JOIN` instead.
3. **Do you need only matching rows?** — Use `INNER JOIN` instead.
4. **Handle NULLs explicitly** — unmatched rows produce NULLs. Use `COALESCE` or `CASE` to label them.

## Starter SQL

```sql
-- All categories and all products, matched or not
SELECT
    COALESCE(c.name, '(no category)') AS category,
    p.name AS product,
    p.price
FROM categories c
FULL JOIN products p ON p.category_id = c.id
ORDER BY category, product;
```

## Solution

```sql
-- Complete customer-order view (no data lost from either side)
SELECT
    c.id AS customer_id,
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.order_date,
    o.total_amount
FROM customers c
FULL JOIN orders o ON o.customer_id = c.id
ORDER BY c.last_name NULLS LAST, o.order_date NULLS LAST;

-- Find unmatched rows on either side
SELECT
    CASE
        WHEN c.id IS NULL THEN 'Order without customer'
        WHEN o.id IS NULL THEN 'Customer without order'
        ELSE 'Matched'
    END AS match_status,
    c.id AS customer_id,
    c.first_name,
    o.id AS order_id,
    o.order_date
FROM customers c
FULL JOIN orders o ON o.customer_id = c.id
WHERE c.id IS NULL OR o.id IS NULL;

-- Category coverage report: which categories have products and which don't?
SELECT
    c.name AS category,
    COUNT(p.id) AS product_count,
    CASE
        WHEN COUNT(p.id) = 0 THEN 'Empty'
        WHEN COUNT(p.id) < 3 THEN 'Low'
        ELSE 'Good'
    END AS coverage
FROM categories c
FULL JOIN products p ON p.category_id = c.id
GROUP BY c.name
ORDER BY product_count DESC;

-- Compare join types side by side (run each separately)
-- INNER: only matched rows
SELECT 'INNER' AS join_type, COUNT(*) AS row_count
FROM categories c
INNER JOIN products p ON p.category_id = c.id;

-- LEFT: all categories + matched products
SELECT 'LEFT' AS join_type, COUNT(*) AS row_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id;

-- FULL: all categories + all products
SELECT 'FULL' AS join_type, COUNT(*) AS row_count
FROM categories c
FULL JOIN products p ON p.category_id = c.id;
```

The first query shows the complete picture — every customer and every order, regardless of matching. In our schema, every order has a valid `customer_id` (enforced by the foreign key), so you won't see "orphan orders." But the pattern is valuable for less constrained data.

The second query uses `FULL JOIN` specifically to find mismatches. The `WHERE c.id IS NULL OR o.id IS NULL` filter keeps only unmatched rows from either side. This is the **symmetric anti-join** pattern.

The third query combines `FULL JOIN` with aggregation to create a coverage report. Categories with zero products are labeled "Empty." This works because `FULL JOIN` preserves all categories.

The fourth set of queries lets you run each join type separately and compare row counts. This demonstrates how different join types include or exclude rows.

## Alternative Solutions

`FULL JOIN` can be emulated with `UNION ALL` of a `LEFT JOIN` and an anti-join:

```sql
-- Emulating FULL JOIN (for databases that don't support it)
-- Part 1: LEFT JOIN (all left rows + matched right rows)
SELECT c.name AS category, p.name AS product
FROM categories c
LEFT JOIN products p ON p.category_id = c.id

UNION ALL

-- Part 2: Right-only rows (not already included)
SELECT NULL AS category, p.name AS product
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.id = p.category_id
);
```

This is rarely needed — PostgreSQL, MySQL 8+, SQL Server, and Oracle all support `FULL JOIN` natively. But understanding the decomposition helps you see what `FULL JOIN` actually computes.
