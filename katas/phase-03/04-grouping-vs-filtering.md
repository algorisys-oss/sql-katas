---
id: grouping-vs-filtering
phase: 3
phase_title: Aggregation & GROUP BY
sequence: 4
title: Grouping vs Filtering Logic
---

## Description

### Putting It All Together

You now know all the pieces of SQL's aggregation pipeline:

- `WHERE` filters rows
- `GROUP BY` partitions rows into groups
- Aggregate functions summarize each group
- `HAVING` filters groups
- `ORDER BY` sorts the result
- `LIMIT` caps the output

The challenge is knowing **when to use which**. This kata focuses on building the mental model for choosing correctly.

### The Complete Execution Order

SQL processes a query in this logical order:

```
1. FROM      — identify the source table(s)
2. WHERE     — filter individual rows
3. GROUP BY  — partition remaining rows into groups
4. HAVING    — filter groups based on aggregates
5. SELECT    — compute output columns and aliases
6. DISTINCT  — remove duplicate rows (if specified)
7. ORDER BY  — sort the final result
8. LIMIT     — restrict the number of output rows
```

Every clause operates on the output of the previous step. This is why:
- `WHERE` cannot use aggregates (groups do not exist yet)
- `HAVING` can use aggregates (groups have been formed)
- `ORDER BY` can use aliases (SELECT has already run)
- `WHERE` cannot use aliases (SELECT has not run yet)

### Decision Framework

When writing an aggregation query, ask these questions in order:

**Question 1: Do I need to exclude certain rows before grouping?**
→ Use `WHERE`

Examples: "only delivered orders," "products created after 2024," "customers from the US"

**Question 2: What groups do I need?**
→ Use `GROUP BY`

Examples: "per customer," "per category," "per month"

**Question 3: What summary do I need for each group?**
→ Use aggregate functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`)

**Question 4: Do I need to exclude certain groups based on their summary?**
→ Use `HAVING`

Examples: "only groups with more than 5 orders," "only categories where average price > $50"

### Common Patterns

**Pattern 1: Top-N per metric**

Find the top 5 best-selling products:

```sql
SELECT product_id, SUM(quantity) AS total_sold
FROM order_items
GROUP BY product_id
ORDER BY total_sold DESC
LIMIT 5;
```

**Pattern 2: Filter then summarize**

Revenue from delivered orders per customer:

```sql
SELECT customer_id, SUM(total_amount) AS revenue
FROM orders
WHERE status = 'delivered' AND total_amount IS NOT NULL
GROUP BY customer_id
ORDER BY revenue DESC;
```

**Pattern 3: Summarize then filter groups**

Customers with above-average order frequency:

```sql
SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > (SELECT AVG(cnt) FROM (SELECT COUNT(*) AS cnt FROM orders GROUP BY customer_id) sub)
ORDER BY order_count DESC;
```

**Pattern 4: Percentage calculations within groups**

What percentage of each customer's orders are delivered?

```sql
SELECT
    customer_id,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'delivered')::numeric / COUNT(*) * 100, 1
    ) AS delivered_pct
FROM orders
GROUP BY customer_id
ORDER BY delivered_pct DESC;
```

### Common Mistakes

**Mistake 1: Using HAVING when WHERE would work**

```sql
-- INEFFICIENT: groups all products, then filters
SELECT category_id, AVG(price) AS avg_price
FROM products
GROUP BY category_id
HAVING category_id IN (1, 2, 3);

-- BETTER: filter first, then group
SELECT category_id, AVG(price) AS avg_price
FROM products
WHERE category_id IN (1, 2, 3)
GROUP BY category_id;
```

If the condition does not involve an aggregate, it belongs in `WHERE`.

**Mistake 2: Forgetting that WHERE runs before GROUP BY**

```sql
-- WRONG: trying to filter on an aggregate in WHERE
SELECT customer_id, SUM(total_amount) AS total_spent
FROM orders
WHERE SUM(total_amount) > 500
GROUP BY customer_id;

-- CORRECT: use HAVING for aggregate conditions
SELECT customer_id, SUM(total_amount) AS total_spent
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) > 500;
```

**Mistake 3: Mixing aggregated and non-aggregated columns**

```sql
-- WRONG: order_date is not grouped or aggregated
SELECT customer_id, order_date, COUNT(*)
FROM orders
GROUP BY customer_id;

-- OPTION A: add it to GROUP BY (more groups)
SELECT customer_id, order_date, COUNT(*)
FROM orders
GROUP BY customer_id, order_date;

-- OPTION B: aggregate it (keeps one row per customer)
SELECT customer_id, MIN(order_date) AS first_order, MAX(order_date) AS last_order, COUNT(*)
FROM orders
GROUP BY customer_id;
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Read the question carefully** — identify what is being asked (a count? a sum? a comparison?).
2. **Identify the base table** — which table has the rows you need?
3. **Decide on row filters** — which rows should be excluded before aggregation? → `WHERE`
4. **Decide on grouping** — what defines each group? → `GROUP BY`
5. **Choose aggregates** — what computation per group? → `COUNT`, `SUM`, `AVG`, etc.
6. **Decide on group filters** — which groups to keep? → `HAVING`
7. **Order and limit** — how should the result be sorted and trimmed?

## Starter SQL

```sql
-- For each order status, show the count and average amount
-- Only include statuses with at least 5 orders
SELECT
    status,
    COUNT(*) AS order_count,
    ROUND(AVG(total_amount), 2) AS avg_amount
FROM orders
GROUP BY status
HAVING COUNT(*) >= 5
ORDER BY order_count DESC;
```

## Solution

```sql
-- Business question: Which categories generate the most revenue?
-- Step 1: Join order_items with products to get category info
-- Step 2: Group by category
-- Step 3: Sum revenue per category
-- Step 4: Show only categories with > $100 in revenue
SELECT
    p.category_id,
    COUNT(DISTINCT oi.order_id) AS orders_containing_category,
    SUM(oi.quantity) AS total_units_sold,
    ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.category_id
HAVING SUM(oi.quantity * oi.unit_price) > 100
ORDER BY total_revenue DESC;

-- Business question: Customer order summary with segmentation
-- Segment customers by order frequency
SELECT
    customer_id,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    ROUND(SUM(total_amount), 2) AS lifetime_value,
    MIN(order_date) AS first_order,
    MAX(order_date) AS last_order,
    MAX(order_date) - MIN(order_date) AS customer_lifespan
FROM orders
GROUP BY customer_id
ORDER BY lifetime_value DESC NULLS LAST;

-- Business question: Monthly order trends (only complete months)
SELECT
    DATE_TRUNC('month', order_date)::date AS month,
    COUNT(*) AS orders,
    COUNT(DISTINCT customer_id) AS unique_customers,
    ROUND(SUM(total_amount), 2) AS revenue,
    ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders
WHERE total_amount IS NOT NULL
GROUP BY DATE_TRUNC('month', order_date)
HAVING COUNT(*) >= 3
ORDER BY month;

-- Business question: Find products that have never been in a cancelled order
-- Uses WHERE to pre-filter, then groups to find popular items
SELECT
    oi.product_id,
    SUM(oi.quantity) AS units_sold,
    COUNT(DISTINCT oi.order_id) AS order_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status != 'cancelled'
GROUP BY oi.product_id
HAVING COUNT(DISTINCT oi.order_id) >= 2
ORDER BY units_sold DESC;
```

The first query demonstrates the full pipeline: join → group → aggregate → filter groups → sort. It answers a real business question about category performance.

The second query builds a customer summary with multiple aggregates in one pass. `FILTER` clauses count specific statuses without separate queries. `NULLS LAST` in the `ORDER BY` ensures customers with NULL lifetime values appear at the bottom.

The third query shows monthly trends. `WHERE` removes NULLs before grouping, `GROUP BY` creates monthly buckets, `HAVING` keeps only months with enough data, and `ORDER BY` sorts chronologically.

The fourth query combines a join with `WHERE` filtering (exclude cancelled orders) and `HAVING` filtering (keep products with 2+ orders). This layered approach — filter rows, then filter groups — is the heart of aggregation queries.

## Alternative Solutions

For readability with complex aggregations, you can use CTEs to separate the steps:

```sql
-- Step-by-step using a CTE
WITH delivered_orders AS (
    SELECT customer_id, total_amount
    FROM orders
    WHERE status = 'delivered' AND total_amount IS NOT NULL
)
SELECT
    customer_id,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS total_revenue,
    ROUND(AVG(total_amount), 2) AS avg_order
FROM delivered_orders
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY total_revenue DESC;
```

The CTE makes the filtering step explicit and separate from the aggregation step. The query does the same thing as combining `WHERE` and `GROUP BY` in a single query, but the intent is clearer.

You can also use subqueries in `HAVING` for dynamic thresholds:

```sql
-- Find customers who order more frequently than average
SELECT
    customer_id,
    COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > (
    SELECT AVG(order_count)
    FROM (SELECT COUNT(*) AS order_count FROM orders GROUP BY customer_id) sub
)
ORDER BY order_count DESC;
```

This compares each customer's order count against the average across all customers. The subquery in `HAVING` computes that average dynamically.
