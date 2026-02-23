---
id: moving-averages
phase: 8
phase_title: Advanced Window & Analytical Queries
sequence: 2
title: Moving Averages
---

## Description

### Smoothing Out Noise

A **moving average** computes the average of a fixed number of recent rows, sliding forward as you move through the data. It smooths out short-term fluctuations and reveals trends.

```sql
SELECT
    order_date,
    total_amount,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_3
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

### Visualizing a 3-Row Moving Average

```
Row 1: amount = 100  │ avg(100)           = 100.00
Row 2: amount = 200  │ avg(100, 200)      = 150.00
Row 3: amount =  50  │ avg(100, 200, 50)  = 116.67  ← full window
Row 4: amount = 300  │ avg(200, 50, 300)  = 183.33  ← window slides
Row 5: amount = 150  │ avg(50, 300, 150)  = 166.67  ← window slides

Window: [2 PRECEDING, CURRENT ROW] = 3 rows max
Early rows use fewer rows (no padding with zeros).
```

### Centered vs Trailing Moving Average

**Trailing** (most common): uses current row and preceding rows:
```sql
-- 5-row trailing moving average
AVG(amount) OVER (ORDER BY date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW)
```

**Centered**: uses rows before and after the current:
```sql
-- 5-row centered moving average
AVG(amount) OVER (ORDER BY date ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING)
```

Centered averages smooth better but cannot be computed for the last N/2 rows (they need future data). Trailing averages only use past data, making them useful for real-time dashboards.

### Monthly Moving Averages

For business analytics, aggregate to monthly level first, then apply the moving average:

```sql
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS month,
        ROUND(SUM(total_amount), 2) AS revenue
    FROM orders
    WHERE total_amount IS NOT NULL
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    month,
    revenue,
    ROUND(AVG(revenue) OVER (
        ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS revenue_ma_3m
FROM monthly
ORDER BY month;
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price

## Step-by-Step Reasoning

1. **What granularity?** → Per-row, per-day, per-month? Aggregate first if needed.
2. **Window size?** → How many periods to average (3, 5, 7)?
3. **Trailing or centered?** → Trailing for real-time, centered for historical analysis.
4. **Frame specification** → `ROWS BETWEEN N PRECEDING AND CURRENT ROW`.

## Starter SQL

```sql
-- 3-order moving average
SELECT
    order_date,
    total_amount,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_3
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

## Solution

```sql
-- Compare different window sizes
SELECT
    order_date,
    total_amount,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS ma_3,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ), 2) AS ma_5,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
    ), 2) AS ma_10
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;

-- Monthly moving averages with trend detection
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS month,
        COUNT(*) AS order_count,
        ROUND(SUM(total_amount), 2) AS revenue
    FROM orders
    WHERE total_amount IS NOT NULL
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    month,
    order_count,
    revenue,
    ROUND(AVG(revenue) OVER (
        ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS revenue_ma_3m,
    CASE
        WHEN revenue > AVG(revenue) OVER (
            ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) THEN 'Above trend'
        ELSE 'Below trend'
    END AS trend_position
FROM monthly
ORDER BY month;

-- Per-customer moving average order value
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount,
    ROUND(AVG(o.total_amount) OVER (
        PARTITION BY o.customer_id
        ORDER BY o.order_date
        ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_2
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.total_amount IS NOT NULL
ORDER BY c.last_name, o.order_date;
```

The first query shows 3, 5, and 10-row moving averages side by side. Larger windows are smoother but respond slower to changes.

The second query adds trend detection: is the current month's revenue above or below its 3-month moving average? This simple signal highlights emerging trends.

The third query computes per-customer moving averages with `PARTITION BY`. Each customer's sliding window operates independently.

## Alternative Solutions

For time-based windows (e.g., "average of the last 30 days" regardless of row count), use `RANGE` instead of `ROWS`:

```sql
-- Average of all orders within 30 days before current order
SELECT
    order_date,
    total_amount,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date
        RANGE BETWEEN INTERVAL '30 days' PRECEDING AND CURRENT ROW
    ), 2) AS avg_last_30_days
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

`RANGE` with intervals is PostgreSQL-specific and operates on logical date ranges rather than physical row counts. This is useful when data is unevenly spaced.
