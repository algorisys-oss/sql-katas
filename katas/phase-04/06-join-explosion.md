---
id: join-explosion
phase: 4
phase_title: Joins & Relationships
sequence: 6
title: Join Explosion & Duplication
---

## Description

### When Joins Create More Rows Than You Expect

A common surprise: your query returns more rows than either input table. This happens because **joins multiply rows** when the relationship is one-to-many or many-to-many.

Understanding row multiplication is essential. Without it, you will get incorrect counts, inflated sums, and results that look right but are wrong.

### How Row Multiplication Works

Consider an order with 3 line items:

| order_id | order_date |
|----------|------------|
| 1 | 2024-02-01 |

| order_item_id | order_id | product_id | quantity |
|---------------|----------|------------|----------|
| 1 | 1 | 101 | 1 |
| 2 | 1 | 102 | 2 |
| 3 | 1 | 103 | 1 |

When you join `orders` to `order_items`:

```sql
SELECT o.id, o.order_date, oi.product_id, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = 1;
```

The result has **3 rows** — the single order row is duplicated for each matching order item. This is correct and expected.

### The Danger: Aggregating After a Multiplying Join

The problem arises when you aggregate over duplicated rows:

```sql
-- WRONG: total_amount is counted once per order item, inflating the sum
SELECT
    c.first_name,
    COUNT(*) AS order_count,
    SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.first_name;
```

If customer Alice has 2 orders, and each order has 3 items, the join produces 6 rows for Alice. Then:
- `COUNT(*)` returns 6 (not 2 — the actual order count)
- `SUM(o.total_amount)` adds Alice's order totals 3 times each (once per item)

This is a **join explosion** — the aggregation is computed over inflated data.

### Detecting Join Explosion

Before aggregating, check the raw join output:

```sql
-- Step 1: Look at the raw joined data
SELECT c.first_name, o.id AS order_id, o.total_amount, oi.id AS item_id
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE c.id = 1
ORDER BY o.id, oi.id;
```

If you see the same `order_id` and `total_amount` repeated across multiple rows, aggregating `total_amount` will double-count.

### Solution 1: Aggregate at the Right Level

Aggregate before joining, so each level has the correct grain:

```sql
-- First aggregate order items per order
-- Then join to customers
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(*) AS order_count,
    SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name;
```

By not joining `order_items`, the `orders` rows are not duplicated, and the aggregation is correct.

If you need item-level data too, aggregate items separately:

```sql
-- Aggregate items per order in a subquery
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.total_amount,
    item_summary.item_count,
    item_summary.items_total
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN (
    SELECT order_id, COUNT(*) AS item_count, SUM(quantity * unit_price) AS items_total
    FROM order_items
    GROUP BY order_id
) item_summary ON item_summary.order_id = o.id
ORDER BY c.last_name, o.order_date;
```

The subquery aggregates `order_items` first, producing one row per order. Then the join does not multiply anything.

### Solution 2: Use DISTINCT in Aggregates

When you cannot restructure the query, `COUNT(DISTINCT ...)` helps:

```sql
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(DISTINCT o.id) AS order_count,
    -- SUM(DISTINCT o.total_amount) is DANGEROUS — see below
    COUNT(DISTINCT oi.product_id) AS unique_products_ordered
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY order_count DESC;
```

`COUNT(DISTINCT o.id)` correctly counts unique orders even though each order appears multiple times in the join.

**Warning:** `SUM(DISTINCT column)` is almost never correct. It sums unique *values*, not unique *rows*. If two orders both have `total_amount = 79.99`, only one would be summed. Use a subquery instead.

### Solution 3: Use CTEs for Clarity

```sql
WITH customer_orders AS (
    SELECT
        customer_id,
        COUNT(*) AS order_count,
        SUM(total_amount) AS total_spent
    FROM orders
    GROUP BY customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    co.order_count,
    co.total_spent
FROM customers c
JOIN customer_orders co ON co.customer_id = c.id
ORDER BY co.total_spent DESC NULLS LAST;
```

The CTE aggregates at the correct level first. The final join is one-to-one (each customer matches one summary row), so no duplication occurs.

### Many-to-Many Explosion

Many-to-many relationships through bridge tables can also cause explosion:

```sql
-- Each product-tag combination is one row
-- A product with 3 tags appears 3 times
SELECT p.name, t.name AS tag
FROM products p
JOIN product_tags pt ON pt.product_id = p.id
JOIN tags t ON t.id = pt.tag_id;
```

If you aggregate over this (e.g., counting products), products with more tags would be counted multiple times. Use `COUNT(DISTINCT p.id)` or aggregate before joining.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Before aggregating, check the join grain** — does the join produce one row per entity, or multiple?
2. **If one-to-many or many-to-many** — aggregation will be inflated.
3. **Fix it** by either:
   - Aggregating before joining (subquery or CTE)
   - Using `COUNT(DISTINCT ...)` for counts
   - Removing unnecessary joins
4. **Never use `SUM(DISTINCT ...)`** for financial calculations — it removes duplicate values, not duplicate rows.

## Starter SQL

```sql
-- See the duplication: one order with multiple items
SELECT
    o.id AS order_id,
    o.total_amount,
    oi.id AS item_id,
    oi.unit_price,
    oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = 1;
```

## Solution

```sql
-- WRONG: join explosion inflates counts and sums
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(*) AS misleading_count,
    SUM(o.total_amount) AS inflated_total
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY inflated_total DESC NULLS LAST;

-- CORRECT: aggregate at the right level (no order_items join needed)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(*) AS order_count,
    SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY total_spent DESC NULLS LAST;

-- CORRECT: use COUNT(DISTINCT) when you must join through items
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(DISTINCT o.id) AS order_count,
    COUNT(DISTINCT oi.product_id) AS unique_products
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY unique_products DESC;

-- CORRECT: pre-aggregate with a CTE, then join
WITH order_summary AS (
    SELECT
        order_id,
        COUNT(*) AS item_count,
        SUM(quantity * unit_price) AS computed_total
    FROM order_items
    GROUP BY order_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.total_amount AS stored_total,
    os.computed_total,
    os.item_count
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_summary os ON os.order_id = o.id
ORDER BY c.last_name, o.order_date;
```

Run the first query (WRONG) and the second query (CORRECT) and compare the `total_spent` values for the same customer. The inflated query produces higher numbers because `total_amount` is summed once per order item instead of once per order.

The third query uses `COUNT(DISTINCT ...)` to get correct counts even after the multiplying join. This is safe for counting but not for summing.

The fourth query pre-aggregates order items in a CTE, producing one row per order with the item count and computed total. The final join is now one-to-one between orders and their summaries — no duplication.

## Alternative Solutions

You can verify your aggregation is correct by comparing granularities:

```sql
-- Check: does the join change the row count?
SELECT 'orders alone' AS source, COUNT(*) FROM orders
UNION ALL
SELECT 'orders + items', COUNT(*) FROM orders o JOIN order_items oi ON oi.order_id = o.id;
```

If the second count is significantly larger, you have row multiplication. This is expected — but any aggregation on `orders` columns will be inflated.

Another approach is to use **lateral joins** (PostgreSQL-specific) to aggregate per-row without multiplication:

```sql
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    order_stats.order_count,
    order_stats.total_spent
FROM customers c
JOIN LATERAL (
    SELECT COUNT(*) AS order_count, SUM(total_amount) AS total_spent
    FROM orders WHERE customer_id = c.id
) order_stats ON true
ORDER BY order_stats.total_spent DESC NULLS LAST;
```

The `LATERAL` subquery runs once per customer, computing the correct aggregation without any join multiplication. This pattern is especially useful when combining aggregations from multiple tables.
