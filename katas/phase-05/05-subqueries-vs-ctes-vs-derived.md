---
id: subqueries-vs-ctes-vs-derived
phase: 5
phase_title: Subqueries & CTEs
sequence: 5
title: Subqueries vs CTEs vs Derived Tables
---

## Description

### Three Ways to Nest Queries

SQL gives you three mechanisms for composing queries from other queries:

1. **Subqueries** — nested inside `WHERE`, `SELECT`, or `HAVING`
2. **Derived tables** — subqueries in the `FROM` clause (inline views)
3. **CTEs** — named intermediate results using `WITH`

All three can solve the same problems. The choice depends on readability, reusability, and performance.

### Visual Comparison

```
┌──────────────────────────────────────────────────────────────────┐
│ SUBQUERY (in WHERE)                                             │
│                                                                  │
│ SELECT name, price                                               │
│ FROM products                                                    │
│ WHERE price > (SELECT AVG(price) FROM products);                 │
│               └────────── nested inside WHERE ──────────┘        │
│                                                                  │
│ ✓ Concise for simple conditions                                  │
│ ✗ Hard to read when deeply nested                                │
│ ✗ Cannot be reused in the same query                             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ DERIVED TABLE (in FROM)                                         │
│                                                                  │
│ SELECT p.name, p.price, stats.avg_price                          │
│ FROM products p                                                  │
│ JOIN (                                                           │
│     SELECT category_id, AVG(price) AS avg_price                  │
│     FROM products GROUP BY category_id                           │
│ ) stats ON stats.category_id = p.category_id;                    │
│ └──────── subquery in FROM, must be aliased ─────────┘           │
│                                                                  │
│ ✓ Self-contained — all logic in one place                        │
│ ✗ Cannot be reused in the same query                             │
│ ✗ Gets deeply nested with multiple levels                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ CTE (WITH clause)                                               │
│                                                                  │
│ WITH category_stats AS (                                         │
│     SELECT category_id, AVG(price) AS avg_price                  │
│     FROM products GROUP BY category_id                           │
│ )                                                                │
│ SELECT p.name, p.price, cs.avg_price                             │
│ FROM products p                                                  │
│ JOIN category_stats cs ON cs.category_id = p.category_id;        │
│                                                                  │
│ ✓ Named and readable                                             │
│ ✓ Can be referenced multiple times                               │
│ ✓ Each step testable independently                               │
│ ✗ Slightly more verbose for simple cases                         │
└──────────────────────────────────────────────────────────────────┘
```

### Decision Guide

| Scenario | Best Choice | Why |
|----------|-------------|-----|
| Simple value comparison in WHERE | Subquery | Concise, reads naturally |
| EXISTS / NOT EXISTS checks | Subquery | Standard pattern |
| Single-use intermediate result | Derived table or CTE | Either works; CTE if complex |
| Multi-step transformations | CTE | Named steps, top-to-bottom flow |
| Same intermediate result used twice | CTE | Define once, reference multiple times |
| Recursive traversal | CTE | Only CTEs support `RECURSIVE` |
| Performance-sensitive query | Test all three | Optimizer may handle them differently |

### Same Problem, Three Ways

**Question:** Find customers who have spent more than $200 total on delivered orders.

**Approach 1: Subquery in WHERE**

```sql
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE c.id IN (
    SELECT customer_id
    FROM orders
    WHERE status = 'delivered'
    GROUP BY customer_id
    HAVING SUM(total_amount) > 200
);
```

**Approach 2: Derived Table**

```sql
SELECT c.first_name || ' ' || c.last_name AS customer, hs.total_spent
FROM customers c
JOIN (
    SELECT customer_id, SUM(total_amount) AS total_spent
    FROM orders
    WHERE status = 'delivered'
    GROUP BY customer_id
    HAVING SUM(total_amount) > 200
) hs ON hs.customer_id = c.id
ORDER BY hs.total_spent DESC;
```

**Approach 3: CTE**

```sql
WITH high_spenders AS (
    SELECT customer_id, SUM(total_amount) AS total_spent
    FROM orders
    WHERE status = 'delivered'
    GROUP BY customer_id
    HAVING SUM(total_amount) > 200
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    hs.total_spent
FROM customers c
JOIN high_spenders hs ON hs.customer_id = c.id
ORDER BY hs.total_spent DESC;
```

All three return the same result. The CTE version separates the "find high spenders" logic from the "get their names" logic, making it the most readable.

### Nesting Depth: When CTEs Win

Compare these equivalent queries for a 3-step analysis:

**Derived tables (deeply nested):**

```sql
SELECT customer, order_count, segment
FROM (
    SELECT customer, order_count,
        CASE WHEN order_count >= 3 THEN 'Loyal' ELSE 'Casual' END AS segment
    FROM (
        SELECT
            c.first_name || ' ' || c.last_name AS customer,
            COUNT(*) AS order_count
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id, c.first_name, c.last_name
    ) customer_counts
) segmented
WHERE segment = 'Loyal';
```

**CTEs (flat and readable):**

```sql
WITH customer_counts AS (
    SELECT
        c.id AS customer_id,
        c.first_name || ' ' || c.last_name AS customer,
        COUNT(*) AS order_count
    FROM customers c
    JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id, c.first_name, c.last_name
),
segmented AS (
    SELECT customer, order_count,
        CASE WHEN order_count >= 3 THEN 'Loyal' ELSE 'Casual' END AS segment
    FROM customer_counts
)
SELECT customer, order_count, segment
FROM segmented
WHERE segment = 'Loyal';
```

The CTE version reads top to bottom. The derived table version reads inside out. For multi-step logic, CTEs are significantly easier to understand and maintain.

### Performance Notes

In PostgreSQL 12+:
- **Single-use CTEs** are typically inlined by the optimizer (same plan as a derived table)
- **Multi-reference CTEs** are materialized (computed once, which can be faster or slower)
- **Subqueries** in `WHERE` are often converted to joins by the optimizer

In practice, all three approaches usually produce the same execution plan. Choose based on readability first, then profile if performance matters.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **How many steps does the query need?** — More steps → CTE.
2. **Is the intermediate result reused?** — Yes → CTE. No → any approach works.
3. **Is it a simple existence or value check?** — Subquery in `WHERE`.
4. **Will the query be maintained by a team?** — Prefer CTEs for clarity.
5. **Is this a performance hotspot?** — Test all three, compare `EXPLAIN ANALYZE`.

## Starter SQL

```sql
-- CTE approach: products above their category average
WITH category_avg AS (
    SELECT category_id, ROUND(AVG(price), 2) AS avg_price
    FROM products
    GROUP BY category_id
)
SELECT
    p.name,
    p.price,
    ca.avg_price AS category_avg
FROM products p
JOIN category_avg ca ON ca.category_id = p.category_id
WHERE p.price > ca.avg_price
ORDER BY p.price - ca.avg_price DESC;
```

## Solution

```sql
-- Approach 1: Subquery — find products in the most popular category
SELECT name, price, category_id
FROM products
WHERE category_id = (
    SELECT category_id
    FROM products
    GROUP BY category_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
)
ORDER BY price DESC;

-- Approach 2: Derived table — order value distribution
SELECT
    value_range,
    COUNT(*) AS order_count
FROM (
    SELECT
        CASE
            WHEN total_amount < 50 THEN 'Under $50'
            WHEN total_amount < 150 THEN '$50–$149'
            WHEN total_amount < 300 THEN '$150–$299'
            ELSE '$300+'
        END AS value_range
    FROM orders
    WHERE total_amount IS NOT NULL
) bucketed
GROUP BY value_range
ORDER BY MIN(
    CASE value_range
        WHEN 'Under $50' THEN 1
        WHEN '$50–$149' THEN 2
        WHEN '$150–$299' THEN 3
        ELSE 4
    END
);

-- Approach 3: CTE — full customer analytics dashboard
WITH order_stats AS (
    SELECT
        customer_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(total_amount), 0) AS lifetime_value,
        MIN(order_date) AS first_order,
        MAX(order_date) AS last_order
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY customer_id
),
item_stats AS (
    SELECT
        o.customer_id,
        COUNT(DISTINCT oi.product_id) AS unique_products,
        SUM(oi.quantity) AS total_items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
    GROUP BY o.customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    os.order_count,
    ROUND(os.lifetime_value, 2) AS lifetime_value,
    COALESCE(ist.unique_products, 0) AS unique_products,
    COALESCE(ist.total_items, 0) AS total_items,
    os.first_order,
    os.last_order
FROM customers c
JOIN order_stats os ON os.customer_id = c.id
LEFT JOIN item_stats ist ON ist.customer_id = c.id
ORDER BY os.lifetime_value DESC;
```

The first approach uses a subquery to find the most popular category, then filters products by it. Clean and concise for a single-value lookup.

The second approach uses a derived table to bucket orders into value ranges, then counts orders per bucket. The derived table keeps the bucketing logic separate from the aggregation.

The third approach uses multiple CTEs for a complex analytics query. `order_stats` and `item_stats` aggregate different aspects of customer behavior, then the main query joins everything together. This would be nearly unreadable as nested derived tables.

## Alternative Solutions

You can mix approaches in the same query:

```sql
-- CTE + subquery hybrid
WITH active_customers AS (
    SELECT DISTINCT customer_id
    FROM orders
    WHERE order_date >= '2024-06-01'
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS total_orders
FROM customers c
WHERE c.id IN (SELECT customer_id FROM active_customers)
ORDER BY total_orders DESC;
```

This combines a CTE (for clarity) with a correlated subquery (for per-row computation) and a subquery in WHERE (for filtering). Use whatever combination makes the intent clearest.
