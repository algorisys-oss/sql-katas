---
id: right-join
phase: 4
phase_title: Joins & Relationships
sequence: 3
title: RIGHT JOIN
---

## Description

### The Mirror of LEFT JOIN

`RIGHT JOIN` (also `RIGHT OUTER JOIN`) is the exact mirror of `LEFT JOIN`:

- **LEFT JOIN** keeps all rows from the **left** table
- **RIGHT JOIN** keeps all rows from the **right** table

```sql
-- LEFT JOIN: keep all categories
SELECT c.name, p.name AS product
FROM categories c
LEFT JOIN products p ON p.category_id = c.id;

-- Equivalent RIGHT JOIN: keep all categories
SELECT c.name, p.name AS product
FROM products p
RIGHT JOIN categories c ON c.id = p.category_id;
```

These two queries produce **identical results**. The only difference is which table is on which side of the `JOIN` keyword.

### When to Use RIGHT JOIN

In practice, `RIGHT JOIN` is rarely used. Almost any `RIGHT JOIN` can be rewritten as a `LEFT JOIN` by swapping the table order. Most developers and style guides prefer `LEFT JOIN` because:

1. It reads naturally: "start with this table, optionally add that table"
2. It is consistent — all outer joins go in one direction
3. It avoids confusion when chaining multiple joins

```sql
-- RIGHT JOIN (uncommon)
SELECT p.name, c.name AS category
FROM products p
RIGHT JOIN categories c ON c.id = p.category_id;

-- Equivalent LEFT JOIN (preferred)
SELECT p.name, c.name AS category
FROM categories c
LEFT JOIN products p ON p.category_id = c.id;
```

Both are correct. The `LEFT JOIN` version is more conventional.

### The One Case for RIGHT JOIN

Occasionally, `RIGHT JOIN` makes a query read more naturally when you have multiple joins and want to preserve all rows from the **last** table in the chain:

```sql
-- Show all tags, even those not assigned to any product
-- When you're already starting FROM products
SELECT
    p.name AS product,
    t.name AS tag
FROM products p
JOIN product_tags pt ON pt.product_id = p.id
RIGHT JOIN tags t ON t.id = pt.tag_id
ORDER BY t.name, p.name;
```

Here, the query starts from products, joins through the bridge table, but needs all tags — including unassigned ones. A `RIGHT JOIN` on `tags` preserves them.

However, this can be rewritten with `LEFT JOIN` by restructuring:

```sql
-- Same result, LEFT JOIN style
SELECT
    p.name AS product,
    t.name AS tag
FROM tags t
LEFT JOIN product_tags pt ON pt.tag_id = t.id
LEFT JOIN products p ON p.id = pt.product_id
ORDER BY t.name, p.name;
```

### Key Takeaway

> `RIGHT JOIN` exists for completeness. In real-world SQL, prefer `LEFT JOIN` and structure your `FROM` clause accordingly.

Understanding `RIGHT JOIN` matters for:
- Reading existing queries that use it
- SQL interview questions
- Understanding that LEFT/RIGHT are symmetric operations

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `tags` — id, name
- `product_tags` — product_id, tag_id (junction table)

## Step-by-Step Reasoning

1. **Identify which table's rows must all be preserved** — that table goes on the "outer" side.
2. **Prefer LEFT JOIN** — put the preserved table on the left (in `FROM`).
3. **If you encounter a RIGHT JOIN** — mentally swap it to `LEFT JOIN` by reversing the table order.
4. **Use RIGHT JOIN only** when restructuring would make the query significantly harder to read (rare).

## Starter SQL

```sql
-- All categories, including those with no products (using RIGHT JOIN)
SELECT
    p.name AS product,
    c.name AS category
FROM products p
RIGHT JOIN categories c ON c.id = p.category_id
ORDER BY c.name, p.name;
```

## Solution

```sql
-- RIGHT JOIN: preserve all categories
SELECT
    c.name AS category,
    COUNT(p.id) AS product_count
FROM products p
RIGHT JOIN categories c ON c.id = p.category_id
GROUP BY c.name
ORDER BY product_count DESC;

-- Equivalent LEFT JOIN (preferred style)
SELECT
    c.name AS category,
    COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name
ORDER BY product_count DESC;

-- RIGHT JOIN: preserve all tags
SELECT
    p.name AS product,
    t.name AS tag
FROM products p
JOIN product_tags pt ON pt.product_id = p.id
RIGHT JOIN tags t ON t.id = pt.tag_id
ORDER BY t.name, p.name NULLS LAST;

-- Equivalent LEFT JOIN chain (preferred style)
SELECT
    p.name AS product,
    t.name AS tag
FROM tags t
LEFT JOIN product_tags pt ON pt.tag_id = t.id
LEFT JOIN products p ON p.id = pt.product_id
ORDER BY t.name, p.name NULLS LAST;
```

The first pair shows the same category-product count query written both ways. Run both and confirm identical results. The `LEFT JOIN` version reads more naturally: "start with categories, optionally add products."

The second pair preserves all tags. With `RIGHT JOIN`, you start from products and join through the bridge table, then right-join tags to keep unassigned ones. With `LEFT JOIN`, you start from tags and work backward. Both produce the same output.

## Alternative Solutions

Any `RIGHT JOIN` can be mechanically converted to `LEFT JOIN`:

1. Swap the tables on either side of the `JOIN` keyword
2. Change `RIGHT` to `LEFT`
3. Adjust the `ON` clause if needed (column references stay the same)

```sql
-- Original RIGHT JOIN
SELECT a.col1, b.col2
FROM table_a a
RIGHT JOIN table_b b ON b.id = a.b_id;

-- Converted to LEFT JOIN
SELECT a.col1, b.col2
FROM table_b b
LEFT JOIN table_a a ON a.b_id = b.id;
```

The results are identical. Most codebases standardize on `LEFT JOIN` exclusively.
