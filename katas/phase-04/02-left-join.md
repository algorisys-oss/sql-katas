---
id: left-join
phase: 4
phase_title: Joins & Relationships
sequence: 2
title: LEFT JOIN
---

## Description

### Keeping All Rows from One Side

An `INNER JOIN` only returns rows that have matches in both tables. But often you need to keep **all rows from the left table**, even if there is no match on the right side.

That is what `LEFT JOIN` (also written `LEFT OUTER JOIN`) does.

```sql
SELECT
    c.name AS category,
    p.name AS product
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
ORDER BY c.name;
```

This returns **every category**, even those with no products. For categories without products, the product columns will be `NULL`.

### How LEFT JOIN Works

1. Start with every row from the **left table** (the table in `FROM` or before `LEFT JOIN`)
2. For each left row, look for matching rows in the **right table** (after `LEFT JOIN`)
3. If matches exist, produce combined rows (same as INNER JOIN)
4. If **no match** exists, still include the left row — fill right-side columns with `NULL`

### Visualizing the Difference

Consider a simple example with 3 categories and products in only 2 of them:

**INNER JOIN result:**
| category | product |
|----------|---------|
| Electronics | Headphones |
| Books | Clean Code |

**LEFT JOIN result:**
| category | product |
|----------|---------|
| Electronics | Headphones |
| Books | Clean Code |
| Automotive | NULL |

The Automotive category has no products but still appears with `LEFT JOIN`. This is the key difference.

### Finding Missing Relationships

One of the most powerful uses of `LEFT JOIN` is finding rows that **don't have** a match:

```sql
-- Categories with no products
SELECT c.name AS category
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
WHERE p.id IS NULL;
```

The pattern is:
1. `LEFT JOIN` to preserve all left rows
2. `WHERE right_table.column IS NULL` to keep only unmatched rows

This is called an **anti-join** and is one of the most common SQL patterns.

### LEFT JOIN with Aggregation

When aggregating with a `LEFT JOIN`, be careful with `COUNT`:

```sql
-- Count products per category (including empty categories)
SELECT
    c.name AS category,
    COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name
ORDER BY product_count DESC;
```

Notice: `COUNT(p.id)` instead of `COUNT(*)`.

- `COUNT(*)` counts all rows, including those where the right side is NULL — so empty categories would show `1` instead of `0`
- `COUNT(p.id)` counts non-NULL values only — empty categories correctly show `0`

This is a subtle but critical distinction when combining `LEFT JOIN` with aggregation.

### Multiple LEFT JOINs

You can chain multiple left joins:

```sql
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.order_date
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
ORDER BY c.last_name, o.order_date;
```

This shows all customers and their orders. Customers with no orders still appear (with NULL order columns).

### LEFT JOIN vs INNER JOIN: When to Choose

| Use Case | Join Type |
|----------|-----------|
| Only matched rows needed | `INNER JOIN` |
| All rows from left table, matched or not | `LEFT JOIN` |
| Finding unmatched rows | `LEFT JOIN` + `WHERE IS NULL` |
| Aggregating with possible zeros | `LEFT JOIN` + `COUNT(column)` |

The default instinct should be: **if you need to preserve all rows from one side, use LEFT JOIN**. If you only care about matches, use INNER JOIN.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `tags` — id, name
- `product_tags` — product_id, tag_id (junction table)

## Step-by-Step Reasoning

1. **Do you need all rows from one table?** — If yes, that table should be on the left side of a `LEFT JOIN`.
2. **Write the join** — `FROM left_table LEFT JOIN right_table ON condition`.
3. **Check your aggregations** — use `COUNT(right_table.column)` not `COUNT(*)` if you want zeros for unmatched rows.
4. **Finding missing data?** — Add `WHERE right_table.pk IS NULL` to find unmatched rows.

## Starter SQL

```sql
-- All categories with their product count (including empty ones)
SELECT
    c.name AS category,
    COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name
ORDER BY product_count DESC;
```

## Solution

```sql
-- All customers with their order count (including those with no orders)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    c.email,
    COUNT(o.id) AS order_count,
    COALESCE(ROUND(SUM(o.total_amount), 2), 0) AS total_spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name, c.email
ORDER BY total_spent DESC;

-- Categories with no products (anti-join pattern)
SELECT c.name AS empty_category
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
WHERE p.id IS NULL
ORDER BY c.name;

-- Tags that haven't been assigned to any product
SELECT t.name AS unused_tag
FROM tags t
LEFT JOIN product_tags pt ON pt.tag_id = t.id
WHERE pt.tag_id IS NULL
ORDER BY t.name;

-- All products with tag count (including untagged products)
SELECT
    p.name AS product,
    p.price,
    COUNT(pt.tag_id) AS tag_count
FROM products p
LEFT JOIN product_tags pt ON pt.product_id = p.id
GROUP BY p.id, p.name, p.price
ORDER BY tag_count DESC, p.name;

-- Customer order history (all customers, even those without orders)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    c.country,
    o.id AS order_id,
    o.order_date,
    o.status,
    o.total_amount
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
ORDER BY c.last_name, c.first_name, o.order_date NULLS LAST;
```

The first query shows every customer with their spending summary. `LEFT JOIN` ensures customers with zero orders appear. `COUNT(o.id)` correctly returns 0 for them. `COALESCE` converts NULL sums to 0.

The second and third queries use the anti-join pattern: `LEFT JOIN` + `WHERE ... IS NULL`. This is the standard way to find "orphan" rows — categories without products, tags without assignments.

The fourth query counts tags per product. Products with no tags show `tag_count = 0` thanks to `COUNT(pt.tag_id)` (not `COUNT(*)`).

The fifth query shows the raw join result without aggregation. Customers with no orders have NULL in all order columns. `NULLS LAST` puts orderless customers at the bottom.

## Alternative Solutions

The anti-join pattern can also be written with `NOT EXISTS` (covered in Phase 6):

```sql
-- Categories with no products (using NOT EXISTS)
SELECT c.name AS empty_category
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM products p WHERE p.category_id = c.id
);
```

Both approaches find the same rows. `LEFT JOIN ... WHERE IS NULL` and `NOT EXISTS` typically have similar performance in PostgreSQL. Choose whichever reads more naturally for the question.

For the `COUNT(*)` vs `COUNT(column)` trap, here is a side-by-side comparison:

```sql
-- WRONG: COUNT(*) counts NULL rows too — empty categories show 1
SELECT c.name, COUNT(*) AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name;

-- CORRECT: COUNT(p.id) skips NULLs — empty categories show 0
SELECT c.name, COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name;
```

Run both queries and compare the results for categories that have no products. This is one of the most common LEFT JOIN mistakes.
