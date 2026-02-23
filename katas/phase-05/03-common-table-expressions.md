---
id: common-table-expressions
phase: 5
phase_title: Subqueries & CTEs
sequence: 3
title: Common Table Expressions (CTEs)
---

## Description

### Naming Your Intermediate Steps

A **Common Table Expression** (CTE) is a named temporary result set defined with the `WITH` keyword. It exists only for the duration of the query.

```sql
WITH expensive_products AS (
    SELECT name, price, category_id
    FROM products
    WHERE price > 100
)
SELECT * FROM expensive_products ORDER BY price DESC;
```

The CTE `expensive_products` acts like a temporary table. The main query can reference it by name. When the query finishes, the CTE disappears.

### Why CTEs Matter

CTEs solve two problems:

**1. Readability** — break complex queries into named, logical steps:

```sql
-- Without CTE: dense and hard to follow
SELECT c.first_name, c.last_name, order_stats.order_count, order_stats.total_spent
FROM customers c
JOIN (
    SELECT customer_id, COUNT(*) AS order_count, SUM(total_amount) AS total_spent
    FROM orders WHERE status = 'delivered' GROUP BY customer_id
) order_stats ON order_stats.customer_id = c.id
WHERE order_stats.total_spent > 200;

-- With CTE: each step is named and clear
WITH delivered_orders AS (
    SELECT customer_id, COUNT(*) AS order_count, SUM(total_amount) AS total_spent
    FROM orders
    WHERE status = 'delivered'
    GROUP BY customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    do.order_count,
    do.total_spent
FROM customers c
JOIN delivered_orders do ON do.customer_id = c.id
WHERE do.total_spent > 200
ORDER BY do.total_spent DESC;
```

Both queries produce the same result. The CTE version is easier to understand, debug, and modify.

**2. Reusability** — reference the same intermediate result multiple times:

```sql
WITH order_stats AS (
    SELECT customer_id, COUNT(*) AS order_count
    FROM orders
    GROUP BY customer_id
)
SELECT
    'Above average' AS segment,
    COUNT(*) AS customer_count
FROM order_stats
WHERE order_count > (SELECT AVG(order_count) FROM order_stats)

UNION ALL

SELECT
    'Below average' AS segment,
    COUNT(*) AS customer_count
FROM order_stats
WHERE order_count <= (SELECT AVG(order_count) FROM order_stats);
```

The `order_stats` CTE is referenced three times. Without a CTE, you would repeat the same subquery in each location.

### Visualizing CTE Execution

```
WITH step_1 AS ( ... ),
     step_2 AS ( ... )
SELECT ... FROM step_2 JOIN step_1 ...;

Execution flow:
┌─────────────────────────────────┐
│ step_1: compute intermediate    │  ← evaluated first
│ result and name it "step_1"     │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ step_2: can reference step_1    │  ← evaluated second
│ to build on the previous result │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ Main query: can reference both  │  ← evaluated last
│ step_1 and step_2               │
└─────────────────────────────────┘
```

Each CTE can reference CTEs defined before it (but not after). The main query can reference all of them.

### Multiple CTEs

Chain multiple CTEs by separating them with commas:

```sql
WITH
    active_customers AS (
        SELECT DISTINCT customer_id
        FROM orders
        WHERE order_date >= '2024-06-01'
    ),
    customer_spending AS (
        SELECT customer_id, SUM(total_amount) AS total_spent
        FROM orders
        WHERE customer_id IN (SELECT customer_id FROM active_customers)
        GROUP BY customer_id
    )
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    cs.total_spent
FROM customer_spending cs
JOIN customers c ON c.id = cs.customer_id
ORDER BY cs.total_spent DESC;
```

The second CTE (`customer_spending`) references the first CTE (`active_customers`). This builds a pipeline of transformations.

### CTEs and Performance

A common misconception: **CTEs are not always optimization barriers in PostgreSQL 12+.**

Before PostgreSQL 12, CTEs were always "materialized" (computed once and stored). Since PostgreSQL 12, the optimizer can "inline" CTEs — treating them like subqueries and optimizing across the boundary.

The exception: if a CTE is referenced **multiple times**, PostgreSQL still materializes it (computes it once, reads it multiple times). You can control this explicitly:

```sql
-- Force materialization (compute once, use many times)
WITH stats AS MATERIALIZED (
    SELECT category_id, AVG(price) AS avg_price
    FROM products
    GROUP BY category_id
)
SELECT * FROM stats;

-- Force inlining (treat as subquery, let optimizer merge)
WITH stats AS NOT MATERIALIZED (
    SELECT category_id, AVG(price) AS avg_price
    FROM products
    GROUP BY category_id
)
SELECT * FROM stats;
```

For most queries, you do not need these hints. The default behavior is correct.

### When to Use CTEs

- **Complex queries** with multiple logical steps
- **Reusing** the same intermediate result
- **Improving readability** of deeply nested subqueries
- **Building data pipelines** step by step

### When NOT to Use CTEs

- **Simple queries** that do not benefit from naming — `SELECT ... FROM ... WHERE` is fine
- **Performance-critical hot paths** where you need the optimizer to inline — test both approaches

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Identify logical steps** — what intermediate results do you need?
2. **Name each step** — choose clear, descriptive CTE names.
3. **Write CTEs in order** — each CTE can only reference those defined before it.
4. **Write the main query** — reference CTEs by name, just like tables.
5. **Test each CTE independently** — run the CTE's body as a standalone query to verify.

## Starter SQL

```sql
-- Customer spending summary using a CTE
WITH customer_orders AS (
    SELECT
        customer_id,
        COUNT(*) AS order_count,
        SUM(total_amount) AS total_spent
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    co.order_count,
    ROUND(co.total_spent, 2) AS total_spent
FROM customers c
JOIN customer_orders co ON co.customer_id = c.id
ORDER BY co.total_spent DESC;
```

## Solution

```sql
-- Multi-step analysis: top products in top categories
WITH category_revenue AS (
    SELECT
        p.category_id,
        SUM(oi.quantity * oi.unit_price) AS total_revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    GROUP BY p.category_id
),
top_categories AS (
    SELECT category_id
    FROM category_revenue
    ORDER BY total_revenue DESC
    LIMIT 5
)
SELECT
    c.name AS category,
    p.name AS product,
    p.price,
    p.stock_quantity
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.category_id IN (SELECT category_id FROM top_categories)
ORDER BY c.name, p.price DESC;

-- Customer segmentation pipeline
WITH order_summary AS (
    SELECT
        customer_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(total_amount), 0) AS lifetime_value,
        MIN(order_date) AS first_order,
        MAX(order_date) AS last_order
    FROM orders
    GROUP BY customer_id
),
segmented AS (
    SELECT
        customer_id,
        order_count,
        lifetime_value,
        first_order,
        last_order,
        CASE
            WHEN lifetime_value > 500 THEN 'High Value'
            WHEN lifetime_value > 200 THEN 'Medium Value'
            ELSE 'Low Value'
        END AS segment
    FROM order_summary
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    s.segment,
    s.order_count,
    ROUND(s.lifetime_value, 2) AS lifetime_value,
    s.first_order,
    s.last_order
FROM segmented s
JOIN customers c ON c.id = s.customer_id
ORDER BY s.lifetime_value DESC;

-- Reusing a CTE: compare each product to category average
WITH category_avg AS (
    SELECT
        category_id,
        ROUND(AVG(price), 2) AS avg_price,
        COUNT(*) AS product_count
    FROM products
    GROUP BY category_id
)
SELECT
    p.name,
    p.price,
    ca.avg_price AS category_avg,
    ROUND(p.price - ca.avg_price, 2) AS diff,
    CASE
        WHEN p.price > ca.avg_price THEN 'Above average'
        WHEN p.price < ca.avg_price THEN 'Below average'
        ELSE 'At average'
    END AS position
FROM products p
JOIN category_avg ca ON ca.category_id = p.category_id
ORDER BY diff DESC;
```

The first query builds a two-step pipeline: compute revenue per category → find the top 5 → list products in those categories. Each CTE has a clear purpose.

The second query demonstrates a three-step segmentation pipeline: summarize orders → assign segments → join with customer names. The logic flows top to bottom, making it easy to follow.

The third query uses a CTE to compute category averages once, then joins it to compare every product against its category's average. Without the CTE, you would need a correlated subquery per row.

## Alternative Solutions

CTEs can be replaced by derived tables (inline subqueries in FROM):

```sql
-- Derived table approach (no CTE)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    os.order_count,
    ROUND(os.lifetime_value, 2) AS lifetime_value
FROM customers c
JOIN (
    SELECT customer_id, COUNT(*) AS order_count, COALESCE(SUM(total_amount), 0) AS lifetime_value
    FROM orders
    GROUP BY customer_id
) os ON os.customer_id = c.id
ORDER BY os.lifetime_value DESC;
```

Derived tables are equivalent to CTEs for single-use intermediate results. CTEs are better when:
- The intermediate result is used more than once
- The query has many steps (nested derived tables become hard to read)
- You want to debug step by step (each CTE can be run independently)
