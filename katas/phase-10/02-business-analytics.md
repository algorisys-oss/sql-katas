---
id: business-analytics
phase: 10
phase_title: Real-World SQL Challenges
sequence: 2
title: Business Analytics Queries
---

## Description

### SQL for Business Decision-Making

Business analytics queries combine multiple techniques to answer strategic questions. These go beyond simple aggregation — they require joining, windowing, CTEs, and careful handling of NULLs and time.

### Customer Lifetime Value (CLV)

How much has each customer spent over their entire relationship?

```
CLV components:
  - Total revenue from customer
  - Number of orders
  - Average order value
  - Customer tenure (time since first order)
  - Recency (time since last order)

The RFM framework (Recency, Frequency, Monetary):
  Recency:   How recently did they buy?   (lower = better)
  Frequency:  How often do they buy?       (higher = better)
  Monetary:   How much do they spend?      (higher = better)
```

### Cohort Analysis

Group customers by when they signed up, then track their behavior over time.

```
Cohort = group of customers who share a common starting event

Example: "January 2024 cohort" = all customers created in January 2024

Track: What % of each cohort placed an order in month 1, month 2, month 3...

     Month 0  Month 1  Month 2  Month 3
Jan:  100%     60%      45%      30%     ← retention drops over time
Feb:  100%     55%      40%      —
Mar:  100%     65%      —        —
```

### Funnel Analysis

Track progression through stages:

```
All customers → Placed first order → Placed second order → Became high-value

Stage                  Count    Conversion
─────────────────     ──────   ──────────
Registered             20       100%
Placed 1+ orders       15        75%
Placed 3+ orders        8        40%
Spent > $200            5        25%
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Identify the business question** → What decision does this inform?
2. **Determine the grain** → Per-customer? Per-month? Per-product?
3. **Identify time dimensions** → Cohort month, order month, relative month?
4. **Build incrementally** → Use CTEs to build up complexity in layers.
5. **Validate** → Do the numbers make sense? Do totals add up?

## Starter SQL

```sql
-- Customer summary: basic RFM metrics
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_amount), 0) AS total_spent,
    MIN(o.order_date) AS first_order,
    MAX(o.order_date) AS last_order
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY total_spent DESC;
```

## Solution

```sql
-- Customer Lifetime Value with RFM metrics
WITH customer_metrics AS (
    SELECT
        c.id AS customer_id,
        c.first_name || ' ' || c.last_name AS customer,
        c.created_at::date AS signup_date,
        COUNT(o.id) AS total_orders,
        COALESCE(ROUND(SUM(o.total_amount), 2), 0) AS total_revenue,
        COALESCE(ROUND(AVG(o.total_amount), 2), 0) AS avg_order_value,
        MIN(o.order_date) AS first_order_date,
        MAX(o.order_date) AS last_order_date,
        CURRENT_DATE - MAX(o.order_date) AS days_since_last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.total_amount IS NOT NULL
    GROUP BY c.id, c.first_name, c.last_name, c.created_at
)
SELECT
    customer,
    signup_date,
    total_orders,
    total_revenue,
    avg_order_value,
    first_order_date,
    last_order_date,
    days_since_last_order,
    CASE
        WHEN total_orders = 0 THEN 'Never ordered'
        WHEN days_since_last_order <= 60 THEN 'Active'
        WHEN days_since_last_order <= 180 THEN 'At risk'
        ELSE 'Churned'
    END AS customer_status
FROM customer_metrics
ORDER BY total_revenue DESC;

-- Cohort retention analysis
WITH customer_cohort AS (
    SELECT
        c.id AS customer_id,
        DATE_TRUNC('month', c.created_at)::date AS cohort_month
    FROM customers c
),
order_months AS (
    SELECT
        o.customer_id,
        DATE_TRUNC('month', o.order_date)::date AS order_month
    FROM orders o
),
cohort_activity AS (
    SELECT
        cc.cohort_month,
        om.order_month,
        EXTRACT(YEAR FROM AGE(om.order_month, cc.cohort_month)) * 12 +
            EXTRACT(MONTH FROM AGE(om.order_month, cc.cohort_month)) AS months_since_signup,
        COUNT(DISTINCT cc.customer_id) AS active_customers
    FROM customer_cohort cc
    JOIN order_months om ON om.customer_id = cc.customer_id
    GROUP BY cc.cohort_month, om.order_month
),
cohort_sizes AS (
    SELECT cohort_month, COUNT(*) AS cohort_size
    FROM customer_cohort
    GROUP BY cohort_month
)
SELECT
    ca.cohort_month,
    cs.cohort_size,
    ca.months_since_signup,
    ca.active_customers,
    ROUND(ca.active_customers::numeric / cs.cohort_size * 100, 1) AS retention_pct
FROM cohort_activity ca
JOIN cohort_sizes cs ON cs.cohort_month = ca.cohort_month
WHERE ca.months_since_signup >= 0
ORDER BY ca.cohort_month, ca.months_since_signup;

-- Product category performance
WITH category_sales AS (
    SELECT
        cat.name AS category,
        COUNT(DISTINCT o.id) AS orders_with_category,
        SUM(oi.quantity) AS units_sold,
        ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue,
        COUNT(DISTINCT o.customer_id) AS unique_customers
    FROM categories cat
    JOIN products p ON p.category_id = cat.id
    JOIN order_items oi ON oi.product_id = p.id
    JOIN orders o ON o.id = oi.order_id
    GROUP BY cat.id, cat.name
)
SELECT
    category,
    orders_with_category,
    units_sold,
    revenue,
    unique_customers,
    ROUND(revenue / NULLIF(unique_customers, 0), 2) AS revenue_per_customer,
    ROUND(revenue / SUM(revenue) OVER () * 100, 1) AS pct_of_total_revenue
FROM category_sales
ORDER BY revenue DESC;

-- Customer acquisition funnel
WITH funnel AS (
    SELECT
        COUNT(*) AS total_customers,
        COUNT(*) FILTER (WHERE id IN (
            SELECT DISTINCT customer_id FROM orders
        )) AS placed_order,
        COUNT(*) FILTER (WHERE id IN (
            SELECT customer_id FROM orders
            GROUP BY customer_id HAVING COUNT(*) >= 3
        )) AS placed_3_plus,
        COUNT(*) FILTER (WHERE id IN (
            SELECT customer_id FROM orders
            WHERE total_amount IS NOT NULL
            GROUP BY customer_id HAVING SUM(total_amount) > 200
        )) AS high_value
    FROM customers
)
SELECT
    'Registered' AS stage, total_customers AS count,
    100.0 AS pct FROM funnel
UNION ALL
SELECT
    'Placed 1+ orders', placed_order,
    ROUND(placed_order::numeric / total_customers * 100, 1) FROM funnel
UNION ALL
SELECT
    'Placed 3+ orders', placed_3_plus,
    ROUND(placed_3_plus::numeric / total_customers * 100, 1) FROM funnel
UNION ALL
SELECT
    'High value (>$200)', high_value,
    ROUND(high_value::numeric / total_customers * 100, 1) FROM funnel;
```

The first query builds a complete customer profile with RFM metrics and a status classification (Active, At Risk, Churned, Never ordered).

The second query performs cohort retention analysis: for each signup month, what percentage of customers placed orders in subsequent months. This is the standard retention table used by product and growth teams.

The third query analyzes product categories by revenue, units, and unique customers, plus each category's share of total revenue.

The fourth query builds a conversion funnel: how many customers reach each stage (registered → ordered → repeat → high-value).

## Alternative Solutions

An alternative cohort analysis uses CROSS JOIN to generate all possible cohort × month combinations, showing 0% retention where no activity occurred:

```sql
-- Cohort with explicit zero-fill
WITH cohorts AS (
    SELECT DISTINCT DATE_TRUNC('month', created_at)::date AS cohort_month
    FROM customers
),
months AS (
    SELECT generate_series(0, 11) AS month_offset
)
SELECT
    co.cohort_month,
    m.month_offset,
    COUNT(DISTINCT o.customer_id) AS active,
    (SELECT COUNT(*) FROM customers WHERE DATE_TRUNC('month', created_at)::date = co.cohort_month) AS cohort_size
FROM cohorts co
CROSS JOIN months m
LEFT JOIN customers c
    ON DATE_TRUNC('month', c.created_at)::date = co.cohort_month
LEFT JOIN orders o
    ON o.customer_id = c.id
    AND DATE_TRUNC('month', o.order_date)::date = co.cohort_month + (m.month_offset || ' months')::interval
GROUP BY co.cohort_month, m.month_offset
ORDER BY co.cohort_month, m.month_offset;
```

This approach ensures every cell in the retention table has a value, which is important for visualization.
