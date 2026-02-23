---
id: set-operations
phase: 6
phase_title: Advanced Filtering Patterns
sequence: 3
title: Set Operations
---

## Description

### Combining Result Sets

Set operations combine the results of two or more `SELECT` queries into a single result. They treat each query's output as a **set of rows** and apply mathematical set logic.

The three set operations are:

| Operation | Returns | Duplicates |
|-----------|---------|------------|
| `UNION` | All rows from both queries | Removed |
| `UNION ALL` | All rows from both queries | Kept |
| `INTERSECT` | Rows that appear in both queries | Removed |
| `EXCEPT` | Rows in the first query but not the second | Removed |

### Visualizing Set Operations

```
Query A result:       Query B result:
┌───────────┐         ┌───────────┐
│ Alice     │         │ Bob       │
│ Bob       │         │ Carol     │
│ Carol     │         │ David     │
└───────────┘         └───────────┘

A UNION B:        A INTERSECT B:    A EXCEPT B:
┌───────────┐     ┌───────────┐     ┌───────────┐
│ Alice     │     │ Bob       │     │ Alice     │
│ Bob       │     │ Carol     │     └───────────┘
│ Carol     │     └───────────┘
│ David     │                       B EXCEPT A:
└───────────┘                       ┌───────────┐
                                    │ David     │
                                    └───────────┘
```

### UNION and UNION ALL

`UNION` combines two result sets and removes duplicates:

```sql
-- All unique cities where we have customers OR orders shipped to
SELECT city FROM customers WHERE city IS NOT NULL
UNION
SELECT 'Online' FROM orders WHERE shipped_at IS NOT NULL;
```

`UNION ALL` keeps all rows including duplicates — it is faster because it skips the deduplication step:

```sql
-- All customer IDs from orders + order items (with duplicates)
SELECT customer_id AS id, 'order' AS source FROM orders
UNION ALL
SELECT product_id AS id, 'item' AS source FROM order_items;
```

**Use `UNION ALL` by default** unless you specifically need deduplication. It is more efficient and makes your intent explicit.

### The Column Rule

All queries in a set operation must have:
1. The **same number of columns**
2. **Compatible data types** in corresponding positions

```sql
-- VALID: both have 2 columns (text, numeric)
SELECT name, price FROM products
UNION ALL
SELECT name || ' (category)', id::numeric FROM categories;

-- INVALID: different column counts
SELECT name, price, stock_quantity FROM products
UNION ALL
SELECT name, id FROM categories;  -- ERROR: 3 columns vs 2
```

Column names come from the **first** query. If you need specific names, alias them in the first `SELECT`.

### INTERSECT

`INTERSECT` returns rows that appear in **both** result sets:

```sql
-- Customers who are in BOTH the US and have placed orders
SELECT c.id
FROM customers c
WHERE c.country = 'US'
INTERSECT
SELECT o.customer_id
FROM orders o
WHERE o.status = 'delivered';
```

This finds US customers who also have delivered orders. It is equivalent to:

```sql
SELECT DISTINCT c.id
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'US' AND o.status = 'delivered';
```

`INTERSECT` is often clearer when the two conditions come from different logical contexts.

### EXCEPT

`EXCEPT` returns rows from the first query that are **not in** the second:

```sql
-- Products that have been tagged but never ordered
SELECT p.id, p.name
FROM products p
JOIN product_tags pt ON pt.product_id = p.id

EXCEPT

SELECT p.id, p.name
FROM products p
JOIN order_items oi ON oi.product_id = p.id;
```

This is conceptually similar to an anti-join but works on complete result sets rather than individual row comparisons.

### Set Operations and ORDER BY

`ORDER BY` applies to the **entire combined result**, not to individual queries. Place it at the end:

```sql
SELECT name, 'product' AS type FROM products
UNION ALL
SELECT name, 'category' AS type FROM categories
ORDER BY type, name;  -- sorts the combined result
```

If you need to sort individual queries before combining, use subqueries:

```sql
SELECT * FROM (SELECT name, price FROM products ORDER BY price DESC LIMIT 5) top_products
UNION ALL
SELECT * FROM (SELECT name, 0 AS price FROM categories ORDER BY name LIMIT 5) top_categories;
```

### Practical Use Cases

**1. Combining different entity types into a unified report:**

```sql
SELECT 'Product' AS entity, name, created_at FROM products
UNION ALL
SELECT 'Customer' AS entity, first_name || ' ' || last_name, created_at FROM customers
ORDER BY created_at DESC;
```

**2. Finding gaps in data:**

```sql
-- Categories that exist but have no products assigned
SELECT id, name FROM categories
EXCEPT
SELECT DISTINCT c.id, c.name
FROM categories c
JOIN products p ON p.category_id = c.id;
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Do you need to combine result sets?** → `UNION` or `UNION ALL`.
2. **Do you need only common rows?** → `INTERSECT`.
3. **Do you need to subtract one set from another?** → `EXCEPT`.
4. **Do you need duplicates?** → `UNION ALL` (yes) or `UNION` (no).
5. **Match column counts and types** between all queries.
6. **Put ORDER BY at the end** — it applies to the final combined result.

## Starter SQL

```sql
-- Combine products and categories into a single list
SELECT name, 'product' AS type, price AS value
FROM products
UNION ALL
SELECT name, 'category' AS type, NULL AS value
FROM categories
ORDER BY type, name;
```

## Solution

```sql
-- UNION ALL: timeline of all entity creation dates
SELECT 'Product' AS entity, name, created_at
FROM products
UNION ALL
SELECT 'Customer', first_name || ' ' || last_name, created_at
FROM customers
ORDER BY created_at DESC;

-- UNION: all unique product IDs that were either ordered or tagged
SELECT product_id FROM order_items
UNION
SELECT product_id FROM product_tags
ORDER BY product_id;

-- INTERSECT: product IDs that are BOTH ordered AND tagged
SELECT product_id FROM order_items
INTERSECT
SELECT product_id FROM product_tags
ORDER BY product_id;

-- EXCEPT: product IDs that were ordered but NOT tagged
SELECT DISTINCT product_id FROM order_items
EXCEPT
SELECT product_id FROM product_tags
ORDER BY product_id;

-- EXCEPT reversed: tagged but never ordered
SELECT product_id FROM product_tags
EXCEPT
SELECT DISTINCT product_id FROM order_items
ORDER BY product_id;

-- Practical: customer activity log (orders + cancellations as separate events)
SELECT
    customer_id,
    order_date AS event_date,
    'Placed order #' || id AS event,
    total_amount AS amount
FROM orders
WHERE status != 'cancelled'
UNION ALL
SELECT
    customer_id,
    order_date AS event_date,
    'Cancelled order #' || id AS event,
    total_amount AS amount
FROM orders
WHERE status = 'cancelled'
ORDER BY event_date DESC, customer_id;
```

The first query creates a timeline of all products and customers by creation date. `UNION ALL` keeps everything — no deduplication needed since the entities are different.

The second query uses `UNION` (not ALL) to get the unique set of product IDs that appear in either orders or tags.

The third query uses `INTERSECT` to find products that are both ordered and tagged — the overlap between the two sets.

The fourth and fifth queries use `EXCEPT` in both directions to find the asymmetric differences: ordered-but-not-tagged vs tagged-but-not-ordered.

The sixth query splits orders into "placed" and "cancelled" events using `UNION ALL`, creating an activity log.

## Alternative Solutions

Most `INTERSECT` and `EXCEPT` queries can be rewritten with joins or anti-joins:

```sql
-- INTERSECT equivalent using JOIN
SELECT DISTINCT oi.product_id
FROM order_items oi
JOIN product_tags pt ON pt.product_id = oi.product_id
ORDER BY product_id;

-- EXCEPT equivalent using NOT EXISTS
SELECT DISTINCT oi.product_id
FROM order_items oi
WHERE NOT EXISTS (
    SELECT 1 FROM product_tags pt WHERE pt.product_id = oi.product_id
)
ORDER BY product_id;
```

Choose based on readability. Set operations are clearer when you are thinking in terms of "combine," "overlap," or "subtract" between two result sets. Joins and anti-joins are clearer when the relationship between tables is the focus.

Note: `INTERSECT ALL` and `EXCEPT ALL` also exist (they preserve duplicates) but are rarely used in practice.
