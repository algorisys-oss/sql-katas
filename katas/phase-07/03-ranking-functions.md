---
id: ranking-functions
phase: 7
phase_title: Window Functions
sequence: 3
title: Ranking Functions
---

## Description

### Ordering Rows Within Groups

Ranking functions assign a position number to each row based on an ordering. Combined with `PARTITION BY`, they rank rows **within groups**.

The three ranking functions are:

| Function | Ties | Gaps |
|----------|------|------|
| `ROW_NUMBER()` | No ties — every row gets a unique number | No gaps |
| `RANK()` | Tied values get the same rank | Gaps after ties |
| `DENSE_RANK()` | Tied values get the same rank | No gaps |

### Visualizing the Difference

```
Products ordered by price (within a category):

┌──────────────┬────────┬────────────┬──────┬────────────┐
│ product      │ price  │ ROW_NUMBER │ RANK │ DENSE_RANK │
├──────────────┼────────┼────────────┼──────┼────────────┤
│ Monitor      │ 449.99 │          1 │    1 │          1 │
│ Keyboard     │ 129.99 │          2 │    2 │          2 │
│ Headphones   │  79.99 │          3 │    3 │          3 │
│ Power Bank   │  39.99 │          4 │    4 │          4 │  ← all same
│ USB Cable    │  14.99 │          5 │    5 │          5 │     (no ties)
└──────────────┴────────┴────────────┴──────┴────────────┘

With ties (two products at $49.99):
┌──────────────┬────────┬────────────┬──────┬────────────┐
│ product      │ price  │ ROW_NUMBER │ RANK │ DENSE_RANK │
├──────────────┼────────┼────────────┼──────┼────────────┤
│ Product A    │ 100.00 │          1 │    1 │          1 │
│ Product B    │  49.99 │          2 │    2 │          2 │  ← tied
│ Product C    │  49.99 │          3 │    2 │          2 │  ← tied
│ Product D    │  25.00 │          4 │    4 │          3 │
│                       │            │  ↑   │            │
│                       │            │ gap! │  no gap    │
└──────────────┴────────┴────────────┴──────┴────────────┘

ROW_NUMBER: 1, 2, 3, 4  (arbitrary order for ties)
RANK:       1, 2, 2, 4  (tie at 2, skip 3)
DENSE_RANK: 1, 2, 2, 3  (tie at 2, next is 3)
```

### ORDER BY in OVER()

Ranking functions **require** `ORDER BY` inside the `OVER()` clause to define the ranking order:

```sql
SELECT
    name,
    price,
    ROW_NUMBER() OVER (ORDER BY price DESC) AS price_rank
FROM products;
```

This ranks all products by price, highest first. The `ORDER BY` inside `OVER()` is independent of the query's final `ORDER BY`.

### Ranking Within Partitions

Combine `PARTITION BY` with `ORDER BY` to rank within groups:

```sql
SELECT
    name,
    category_id,
    price,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC) AS rank_in_category
FROM products
ORDER BY category_id, rank_in_category;
```

Each category has its own independent ranking starting from 1.

### Top-N Per Group

The most common ranking pattern — find the top N items within each group:

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

Use `ROW_NUMBER()` for exactly N rows per group. Use `RANK()` or `DENSE_RANK()` if ties should be included.

### Which Ranking Function to Use?

| Scenario | Function | Why |
|----------|----------|-----|
| Exactly N rows per group | `ROW_NUMBER()` | Guarantees unique numbers, no extras from ties |
| Include all tied values in top N | `RANK()` or `DENSE_RANK()` | Ties get the same rank |
| Sequential numbering (1, 2, 3, ...) | `ROW_NUMBER()` or `DENSE_RANK()` | No gaps |
| Deduplication (keep one per group) | `ROW_NUMBER()` | Filter WHERE rn = 1 |

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What ordering defines the rank?** → `ORDER BY` inside `OVER()`.
2. **Within what groups?** → `PARTITION BY` (or omit for global ranking).
3. **How to handle ties?** → `ROW_NUMBER` (no ties), `RANK` (ties + gaps), `DENSE_RANK` (ties, no gaps).
4. **Need top N?** → CTE with `ROW_NUMBER()`, then `WHERE rn <= N`.

## Starter SQL

```sql
-- Rank products by price within each category
SELECT
    name,
    category_id,
    price,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC) AS rn,
    RANK() OVER (PARTITION BY category_id ORDER BY price DESC) AS rnk,
    DENSE_RANK() OVER (PARTITION BY category_id ORDER BY price DESC) AS drnk
FROM products
ORDER BY category_id, price DESC;
```

## Solution

```sql
-- Global product ranking by price
SELECT
    ROW_NUMBER() OVER (ORDER BY price DESC) AS rank,
    name,
    price
FROM products;

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
SELECT rank() OVER (ORDER BY price DESC) AS overall_rank, category, name, price
FROM ranked
WHERE rn <= 2
ORDER BY price DESC;

-- Each customer's most recent order
WITH latest AS (
    SELECT
        o.*,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders o
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    l.id AS order_id,
    l.order_date,
    l.status,
    l.total_amount
FROM latest l
JOIN customers c ON c.id = l.customer_id
WHERE l.rn = 1
ORDER BY l.order_date DESC;

-- Customer spending rank
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COALESCE(SUM(o.total_amount), 0) AS total_spent,
    RANK() OVER (ORDER BY COALESCE(SUM(o.total_amount), 0) DESC) AS spending_rank
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
GROUP BY c.id, c.first_name, c.last_name
ORDER BY spending_rank;

-- Most ordered product per customer
WITH customer_products AS (
    SELECT
        o.customer_id,
        oi.product_id,
        SUM(oi.quantity) AS total_qty,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id
            ORDER BY SUM(oi.quantity) DESC
        ) AS rn
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.customer_id, oi.product_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    p.name AS favorite_product,
    cp.total_qty
FROM customer_products cp
JOIN customers c ON c.id = cp.customer_id
JOIN products p ON p.id = cp.product_id
WHERE cp.rn = 1
ORDER BY c.last_name;
```

The first query ranks all products globally by price.

The second query finds the top 2 products per category, then re-ranks them globally. This shows how window functions can be layered.

The third query uses the `ROW_NUMBER() WHERE rn = 1` pattern to get each customer's most recent order — the same deduplication pattern from Phase 6.

The fourth query combines GROUP BY with a window function. First aggregate spending per customer, then rank them by total. The window function operates on the grouped result.

The fifth query finds each customer's favorite product (most ordered by quantity). It groups by (customer, product), ranks within each customer partition, then keeps only rank 1.

## Alternative Solutions

PostgreSQL's `DISTINCT ON` can replace `ROW_NUMBER() WHERE rn = 1` for simple cases:

```sql
-- Most recent order per customer (DISTINCT ON)
SELECT DISTINCT ON (customer_id)
    customer_id,
    id AS order_id,
    order_date,
    status,
    total_amount
FROM orders
ORDER BY customer_id, order_date DESC;
```

`DISTINCT ON` is more concise but less flexible. `ROW_NUMBER()` lets you:
- Filter for top N (not just top 1)
- Use the rank value in calculations
- Apply different rankings in the same query
