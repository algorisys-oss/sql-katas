---
id: top-n-per-group
phase: 8
phase_title: Advanced Window & Analytical Queries
sequence: 4
title: Top-N Per Group
---

## Description

### A Universal Pattern

"Find the top N items within each group" is one of the most common analytical queries:

- Top 3 products per category by revenue
- Most recent 2 orders per customer
- Highest-paid employee per department

This pattern combines `ROW_NUMBER()` with `PARTITION BY` and a CTE filter.

### The Template

```sql
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY group_column ORDER BY rank_column DESC) AS rn
    FROM table
)
SELECT * FROM ranked WHERE rn <= N;
```

### Choosing the Right Ranking Function

| Need | Function | Behavior |
|------|----------|----------|
| Exactly N rows per group | `ROW_NUMBER()` | Arbitrary tiebreaker |
| All tied values at rank N | `RANK()` | May return more than N rows |
| Dense sequential ranks | `DENSE_RANK()` | Exactly N distinct rank values |

```sql
-- Exactly 2 per group (even with ties)
ROW_NUMBER() OVER (...) AS rn  WHERE rn <= 2  → always 2 rows

-- All ties at rank 2 included
RANK() OVER (...) AS rnk       WHERE rnk <= 2  → 2 or more rows

-- Top 2 distinct rank levels
DENSE_RANK() OVER (...) AS dr  WHERE dr <= 2   → 2+ rows (all at ranks 1 and 2)
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What is the group?** → `PARTITION BY` column(s).
2. **What is the ranking criterion?** → `ORDER BY` column (DESC for top, ASC for bottom).
3. **How many per group?** → N in `WHERE rn <= N`.
4. **Handle ties?** → `ROW_NUMBER` for exact N, `RANK`/`DENSE_RANK` for inclusive ties.

## Starter SQL

```sql
-- Top 2 most expensive products per category
WITH ranked AS (
    SELECT
        p.name,
        c.name AS category,
        p.price,
        ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS rn
    FROM products p
    JOIN categories c ON c.id = p.category_id
)
SELECT category, name, price
FROM ranked
WHERE rn <= 2
ORDER BY category, price DESC;
```

## Solution

```sql
-- Top 3 products per category by price
WITH ranked AS (
    SELECT
        p.name AS product,
        c.name AS category,
        p.price,
        ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS rn
    FROM products p
    JOIN categories c ON c.id = p.category_id
)
SELECT category, rn AS rank, product, price
FROM ranked
WHERE rn <= 3
ORDER BY category, rn;

-- Most recent order per customer
WITH ranked AS (
    SELECT
        o.*,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders o
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    r.order_date AS last_order,
    r.status,
    r.total_amount
FROM ranked r
JOIN customers c ON c.id = r.customer_id
WHERE r.rn = 1
ORDER BY r.order_date DESC;

-- Top 2 best-selling products per category (by quantity sold)
WITH product_sales AS (
    SELECT
        p.id AS product_id,
        p.name AS product,
        p.category_id,
        SUM(oi.quantity) AS total_sold
    FROM products p
    JOIN order_items oi ON oi.product_id = p.id
    GROUP BY p.id, p.name, p.category_id
),
ranked AS (
    SELECT
        ps.*,
        c.name AS category,
        ROW_NUMBER() OVER (PARTITION BY ps.category_id ORDER BY ps.total_sold DESC) AS rn
    FROM product_sales ps
    JOIN categories c ON c.id = ps.category_id
)
SELECT category, rn AS rank, product, total_sold
FROM ranked
WHERE rn <= 2
ORDER BY category, rn;

-- Bottom 2 customers by total spending (least active)
WITH customer_spending AS (
    SELECT
        customer_id,
        COALESCE(SUM(total_amount), 0) AS total_spent,
        COUNT(*) AS order_count
    FROM orders
    GROUP BY customer_id
),
ranked AS (
    SELECT
        cs.*,
        ROW_NUMBER() OVER (ORDER BY cs.total_spent ASC) AS rn
    FROM customer_spending cs
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    r.total_spent,
    r.order_count
FROM ranked r
JOIN customers c ON c.id = r.customer_id
WHERE r.rn <= 5
ORDER BY r.total_spent;
```

The first query shows the classic top-N-per-group pattern with categories and products.

The second query gets the most recent order per customer — `WHERE rn = 1` is the top-1 case.

The third query pre-aggregates sales data before ranking, showing that the pattern works on derived data, not just raw tables.

The fourth query inverts the ordering (ASC) to find the bottom 5 — the least-spending customers.

## Alternative Solutions

PostgreSQL's `DISTINCT ON` can replace top-1 per group:

```sql
-- Top 1 per customer (DISTINCT ON)
SELECT DISTINCT ON (customer_id)
    customer_id, order_date, total_amount, status
FROM orders
ORDER BY customer_id, order_date DESC;
```

But `DISTINCT ON` only works for top-1. For top-N (N > 1), `ROW_NUMBER()` is required.

You can also use `LATERAL` joins for top-N:

```sql
-- Top 2 orders per customer using LATERAL
SELECT c.first_name || ' ' || c.last_name AS customer, t.*
FROM customers c
JOIN LATERAL (
    SELECT order_date, total_amount, status
    FROM orders
    WHERE customer_id = c.id
    ORDER BY order_date DESC
    LIMIT 2
) t ON true
ORDER BY c.last_name, t.order_date DESC;
```

`LATERAL` can be more efficient for top-N with small N, as it avoids ranking the entire dataset.
