---
id: running-totals
phase: 8
phase_title: Advanced Window & Analytical Queries
sequence: 1
title: Running Totals
---

## Description

### Cumulative Calculations

A **running total** (cumulative sum) adds each row's value to the sum of all preceding rows. It answers questions like "how much revenue have we earned so far?" at any point in time.

```sql
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

### Visualizing Running Totals

```
┌────────────┬────────┬───────────────┐
│ order_date │ amount │ running_total │
├────────────┼────────┼───────────────┤
│ 2024-02-01 │  94.98 │         94.98 │  ← 94.98
│ 2024-02-10 │  59.98 │        154.96 │  ← 94.98 + 59.98
│ 2024-02-15 │  84.98 │        239.94 │  ← 154.96 + 84.98
│ 2024-02-20 │  84.98 │        324.92 │  ← 239.94 + 84.98
│ 2024-03-01 │  34.99 │        359.91 │  ← 324.92 + 34.99
└────────────┴────────┴───────────────┘
Each row's running_total = previous running_total + current amount
```

### Running Totals Within Partitions

Compute cumulative sums per customer, per category, or per any grouping:

```sql
SELECT
    customer_id,
    order_date,
    total_amount,
    SUM(total_amount) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS customer_running_total
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY customer_id, order_date;
```

Each customer's running total starts from zero independently.

### Running Count and Running Average

The same pattern works with any aggregate:

```sql
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER w AS running_revenue,
    COUNT(*) OVER w AS running_count,
    ROUND(AVG(total_amount) OVER w, 2) AS running_avg
FROM orders
WHERE total_amount IS NOT NULL
WINDOW w AS (ORDER BY order_date)
ORDER BY order_date;
```

### Percentage of Running Total

Show how much of the final total has been accumulated at each point:

```sql
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total,
    ROUND(
        SUM(total_amount) OVER (ORDER BY order_date) /
        SUM(total_amount) OVER () * 100, 1
    ) AS pct_complete
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What value accumulates?** → The column to sum.
2. **In what order?** → Usually chronological (`ORDER BY date`).
3. **Within what groups?** → `PARTITION BY` for per-group running totals.
4. **Need percentage?** → Divide running total by `SUM() OVER ()` (grand total).

## Starter SQL

```sql
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

## Solution

```sql
-- Monthly revenue with year-to-date running total
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS month,
        COUNT(*) AS orders,
        ROUND(SUM(total_amount), 2) AS revenue
    FROM orders
    WHERE total_amount IS NOT NULL
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    month,
    orders,
    revenue,
    SUM(revenue) OVER (ORDER BY month) AS ytd_revenue,
    ROUND(SUM(revenue) OVER (ORDER BY month) / SUM(revenue) OVER () * 100, 1) AS pct_of_total
FROM monthly
ORDER BY month;

-- Per-customer cumulative spending
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount,
    SUM(o.total_amount) OVER (
        PARTITION BY o.customer_id ORDER BY o.order_date
    ) AS cumulative_spent,
    ROW_NUMBER() OVER (
        PARTITION BY o.customer_id ORDER BY o.order_date
    ) AS order_number
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.total_amount IS NOT NULL
ORDER BY c.last_name, o.order_date;

-- Cumulative customer acquisition
WITH new_customers AS (
    SELECT
        DATE_TRUNC('month', created_at)::date AS month,
        COUNT(*) AS new_count
    FROM customers
    GROUP BY DATE_TRUNC('month', created_at)
)
SELECT
    month,
    new_count,
    SUM(new_count) OVER (ORDER BY month) AS total_customers
FROM new_customers
ORDER BY month;
```

The first query aggregates to monthly level, then applies a running total across months. `pct_of_total` shows revenue progress toward the annual total.

The second query combines a running total with row numbering per customer — showing each customer's cumulative spending and which order number it was.

The third query tracks cumulative customer acquisition over time — a key business metric.

## Alternative Solutions

Running totals can be computed with correlated subqueries (slower but more portable):

```sql
SELECT
    o1.order_date,
    o1.total_amount,
    (SELECT SUM(o2.total_amount) FROM orders o2
     WHERE o2.total_amount IS NOT NULL
     AND o2.order_date <= o1.order_date) AS running_total
FROM orders o1
WHERE o1.total_amount IS NOT NULL
ORDER BY o1.order_date;
```

The window function approach is far more efficient — it processes the data in a single pass rather than executing a subquery per row.
