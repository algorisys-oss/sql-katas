---
id: partition-by
phase: 7
phase_title: Window Functions
sequence: 2
title: PARTITION BY
---

## Description

### Windows Within Windows

`OVER ()` treats all rows as one window. `PARTITION BY` divides rows into **groups** (partitions), and the window function operates independently within each group.

```sql
SELECT
    name,
    category_id,
    price,
    ROUND(AVG(price) OVER (PARTITION BY category_id), 2) AS category_avg
FROM products
ORDER BY category_id, price DESC;
```

Each product now shows the average price **for its own category**, not the global average.

### Visualizing PARTITION BY

```
OVER () — one window for all rows:
┌───────────────────────────────────────┐
│ All products                          │
│ AVG = 99.50                           │
│ ┌──────────┬────────┬───────────────┐ │
│ │ product  │ price  │ avg_price     │ │
│ │ Widget A │  10.00 │        99.50  │ │
│ │ Widget B │  20.00 │        99.50  │ │
│ │ Gadget X │ 200.00 │        99.50  │ │
│ └──────────┴────────┴───────────────┘ │
└───────────────────────────────────────┘

OVER (PARTITION BY category_id) — separate window per category:
┌─────────────────────────┐  ┌─────────────────────────┐
│ Category 1 (Electronics)│  │ Category 2 (Clothing)   │
│ AVG = 142.99            │  │ AVG = 68.99             │
│ ┌────────┬──────┬─────┐ │  │ ┌────────┬──────┬─────┐ │
│ │ prod   │price │ avg │ │  │ │ prod   │price │ avg │ │
│ │ Mon    │449.99│142.9│ │  │ │ Parka  │149.99│68.99│ │
│ │ Keyb   │129.99│142.9│ │  │ │ Shoes  │ 89.99│68.99│ │
│ │ Head   │ 79.99│142.9│ │  │ │ Jeans  │ 59.99│68.99│ │
│ └────────┴──────┴─────┘ │  │ └────────┴──────┴─────┘ │
└─────────────────────────┘  └─────────────────────────┘
```

Each partition computes its own aggregate independently. Rows never cross partition boundaries.

### PARTITION BY vs GROUP BY

This is the most important distinction:

| Feature | GROUP BY | PARTITION BY |
|---------|----------|-------------|
| Collapses rows | Yes (one row per group) | No (all rows preserved) |
| Requires aggregates | Yes | Yes (in window function) |
| Can mix with detail columns | No | Yes |
| Output rows | One per group | One per input row |

```sql
-- GROUP BY: 10 rows (one per category)
SELECT category_id, ROUND(AVG(price), 2) AS avg_price
FROM products GROUP BY category_id;

-- PARTITION BY: 30 rows (one per product), each showing its category average
SELECT name, category_id, price,
    ROUND(AVG(price) OVER (PARTITION BY category_id), 2) AS category_avg
FROM products;
```

### Multiple Partitions in One Query

You can use different partitions in the same query:

```sql
SELECT
    name,
    category_id,
    price,
    ROUND(AVG(price) OVER (), 2) AS global_avg,
    ROUND(AVG(price) OVER (PARTITION BY category_id), 2) AS category_avg,
    COUNT(*) OVER (PARTITION BY category_id) AS products_in_category
FROM products
ORDER BY category_id, price DESC;
```

Each window function has its own `OVER` clause. They can use different partitions — or no partition at all — in the same query.

### Partitioning by Multiple Columns

Like GROUP BY, you can partition by multiple columns:

```sql
SELECT
    customer_id,
    status,
    total_amount,
    COUNT(*) OVER (PARTITION BY customer_id) AS customer_total_orders,
    COUNT(*) OVER (PARTITION BY customer_id, status) AS customer_status_orders
FROM orders
ORDER BY customer_id, status;
```

The first window counts all orders per customer. The second counts orders per (customer, status) combination.

### Practical Pattern: Percentage Within Group

A common use case — what percentage of category revenue does each product represent?

```sql
SELECT
    p.name,
    c.name AS category,
    p.price,
    SUM(p.price) OVER (PARTITION BY p.category_id) AS category_total,
    ROUND(p.price / SUM(p.price) OVER (PARTITION BY p.category_id) * 100, 1) AS pct_of_category
FROM products p
JOIN categories c ON c.id = p.category_id
ORDER BY c.name, pct_of_category DESC;
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What groups do you want to compare within?** → That is your `PARTITION BY`.
2. **What aggregate per group?** → Same functions: COUNT, SUM, AVG, MIN, MAX.
3. **Do you also need global aggregates?** → Use `OVER ()` alongside `OVER (PARTITION BY ...)`.
4. **Multiple groupings?** → Use multiple window functions with different PARTITION BY clauses.

## Starter SQL

```sql
-- Each product with its category average
SELECT
    name,
    category_id,
    price,
    ROUND(AVG(price) OVER (PARTITION BY category_id), 2) AS category_avg,
    ROUND(price - AVG(price) OVER (PARTITION BY category_id), 2) AS diff_from_category_avg
FROM products
ORDER BY category_id, diff_from_category_avg DESC;
```

## Solution

```sql
-- Products: global vs category comparison
SELECT
    p.name,
    c.name AS category,
    p.price,
    ROUND(AVG(p.price) OVER (), 2) AS global_avg,
    ROUND(AVG(p.price) OVER (PARTITION BY p.category_id), 2) AS category_avg,
    ROUND(p.price - AVG(p.price) OVER (PARTITION BY p.category_id), 2) AS diff_from_cat_avg
FROM products p
JOIN categories c ON c.id = p.category_id
ORDER BY c.name, p.price DESC;

-- Customer order analysis: each order in context
SELECT
    o.customer_id,
    o.id AS order_id,
    o.order_date,
    o.total_amount,
    COUNT(*) OVER (PARTITION BY o.customer_id) AS customer_orders,
    ROUND(AVG(o.total_amount) OVER (PARTITION BY o.customer_id), 2) AS customer_avg,
    SUM(o.total_amount) OVER (PARTITION BY o.customer_id) AS customer_lifetime
FROM orders o
WHERE o.total_amount IS NOT NULL
ORDER BY o.customer_id, o.order_date;

-- Revenue share per product within each category
SELECT
    p.name,
    c.name AS category,
    p.price * p.stock_quantity AS inventory_value,
    SUM(p.price * p.stock_quantity) OVER (PARTITION BY p.category_id) AS category_inventory,
    ROUND(
        p.price * p.stock_quantity /
        NULLIF(SUM(p.price * p.stock_quantity) OVER (PARTITION BY p.category_id), 0) * 100,
    1) AS pct_of_category_inventory
FROM products p
JOIN categories c ON c.id = p.category_id
ORDER BY c.name, pct_of_category_inventory DESC;

-- Orders by status: count and percentage per customer
SELECT
    customer_id,
    status,
    COUNT(*) OVER (PARTITION BY customer_id) AS total_orders,
    COUNT(*) OVER (PARTITION BY customer_id, status) AS status_count,
    ROUND(
        COUNT(*) OVER (PARTITION BY customer_id, status)::numeric /
        COUNT(*) OVER (PARTITION BY customer_id) * 100, 1
    ) AS status_pct
FROM orders
ORDER BY customer_id, status;
```

The first query compares each product's price to both the global average and its category average. The `diff_from_cat_avg` column immediately shows which products are expensive or cheap relative to their category.

The second query gives each order full customer context: how many orders the customer has, their average order value, and lifetime spending. Each order row is enriched without collapsing anything.

The third query calculates inventory value percentages within each category. `NULLIF` prevents division by zero for categories with zero inventory value.

The fourth query uses two different partition levels to compute order status distributions per customer. Each row shows the customer's total orders and the count for that specific status.

## Alternative Solutions

You can achieve similar results with self-joins or correlated subqueries, but they are more verbose:

```sql
-- Correlated subquery approach (equivalent to PARTITION BY)
SELECT
    p.name,
    p.category_id,
    p.price,
    (SELECT ROUND(AVG(p2.price), 2) FROM products p2
     WHERE p2.category_id = p.category_id) AS category_avg
FROM products p
ORDER BY p.category_id, p.price DESC;
```

The window function approach computes all partitions in a single pass over the data, while the correlated subquery approach conceptually re-executes for every row. The optimizer may produce similar plans, but window functions express the intent more clearly.
