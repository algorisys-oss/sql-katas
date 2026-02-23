---
id: date-time-functions
phase: 2
phase_title: Filtering & Conditions
sequence: 7
title: Date & Time Functions
---

## Description

### Why Dates Are Hard

Dates in SQL are more complex than they first appear. Time zones, leap years, varying month lengths, and the difference between `date`, `timestamp`, and `interval` types all affect query results.

### Date Types in PostgreSQL

| Type | Example | Contains |
|---|---|---|
| `date` | `'2025-03-15'` | Year, month, day |
| `timestamp` | `'2025-03-15 14:30:00'` | Date + time (no timezone) |
| `timestamptz` | `'2025-03-15 14:30:00+05:30'` | Date + time + timezone |
| `time` | `'14:30:00'` | Time only |
| `interval` | `'3 days'` | Duration |

### Current Date and Time

```sql
CURRENT_DATE                    -- today's date: 2025-03-15
CURRENT_TIMESTAMP               -- now with timezone: 2025-03-15 14:30:00+00
NOW()                           -- same as CURRENT_TIMESTAMP
CURRENT_TIME                    -- current time only
```

### Extracting Parts of Dates

`EXTRACT` pulls individual components from a date or timestamp:

```sql
EXTRACT(YEAR FROM order_date)     -- 2025
EXTRACT(MONTH FROM order_date)    -- 3
EXTRACT(DAY FROM order_date)      -- 15
EXTRACT(DOW FROM order_date)      -- day of week (0=Sunday, 6=Saturday)
EXTRACT(QUARTER FROM order_date)  -- 1-4
EXTRACT(EPOCH FROM order_date)    -- seconds since 1970-01-01
```

PostgreSQL also supports `DATE_PART`, which is equivalent:

```sql
DATE_PART('year', order_date)     -- same as EXTRACT(YEAR FROM order_date)
```

### Date Arithmetic

You can add and subtract intervals from dates:

```sql
order_date + INTERVAL '30 days'     -- 30 days after order
order_date - INTERVAL '1 month'     -- 1 month before order
CURRENT_DATE - order_date           -- days between (returns integer)
order_date - '2025-01-01'::date     -- days since Jan 1
```

`AGE()` computes the difference between two dates as an interval:

```sql
AGE(CURRENT_DATE, order_date)       -- e.g., '3 mons 15 days'
AGE(shipped_at, order_date)         -- time between order and shipping
```

### Truncating Dates

`DATE_TRUNC` rounds a timestamp down to a specified precision:

```sql
DATE_TRUNC('month', order_date)     -- 2025-03-01 (first of month)
DATE_TRUNC('year', order_date)      -- 2025-01-01 (first of year)
DATE_TRUNC('week', order_date)      -- start of the ISO week (Monday)
DATE_TRUNC('hour', created_at)      -- 2025-03-15 14:00:00
```

This is essential for grouping by time periods:

```sql
SELECT DATE_TRUNC('month', order_date) AS month, COUNT(*)
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

### Formatting Dates

`TO_CHAR` formats dates as strings for display:

```sql
TO_CHAR(order_date, 'YYYY-MM-DD')       -- '2025-03-15'
TO_CHAR(order_date, 'Mon DD, YYYY')      -- 'Mar 15, 2025'
TO_CHAR(order_date, 'Day')              -- 'Saturday'
TO_CHAR(order_date, 'HH24:MI:SS')       -- '14:30:00'
```

### Common Patterns

```sql
-- Orders from the last 30 days
WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'

-- Orders this month
WHERE DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)

-- Orders this year
WHERE EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
```

## Schema Overview

- `orders` — id, customer_id, order_date (date), total_amount, status, shipped_at (timestamp, nullable)
- `customers` — id, first_name, last_name, email, city, country, created_at (timestamp)
- `products` — id, name, category_id, price, stock_quantity, created_at (timestamp)

## Step-by-Step Reasoning

1. **What time granularity do you need?** — year, month, week, day, hour?
2. **Extracting or grouping?** — `EXTRACT` for single values, `DATE_TRUNC` for grouping.
3. **Calculating duration?** — use date subtraction or `AGE()`.
4. **Filtering by date range?** — use `>=` and `<` for precise boundaries.
5. **Formatting for display?** — use `TO_CHAR` at the end, not for calculations.

## Starter SQL

```sql
-- Monthly order summary
SELECT
    DATE_TRUNC('month', order_date) AS month,
    COUNT(*) AS order_count,
    SUM(total_amount) AS revenue
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

## Solution

```sql
-- Extract date parts from orders
SELECT
    id,
    order_date,
    EXTRACT(YEAR FROM order_date) AS year,
    EXTRACT(MONTH FROM order_date) AS month,
    EXTRACT(DOW FROM order_date) AS day_of_week,
    TO_CHAR(order_date, 'Day') AS day_name
FROM orders
ORDER BY order_date DESC
LIMIT 15;

-- Monthly revenue report using DATE_TRUNC
SELECT
    DATE_TRUNC('month', order_date) AS month,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS revenue,
    ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;

-- Orders by day of week: which days are busiest?
SELECT
    EXTRACT(DOW FROM order_date) AS dow,
    TO_CHAR(order_date, 'Day') AS day_name,
    COUNT(*) AS order_count,
    ROUND(AVG(total_amount), 2) AS avg_amount
FROM orders
GROUP BY EXTRACT(DOW FROM order_date), TO_CHAR(order_date, 'Day')
ORDER BY dow;

-- Shipping time: how long does delivery take?
SELECT
    id,
    order_date,
    shipped_at,
    shipped_at::date - order_date AS days_to_ship,
    AGE(shipped_at, order_date::timestamp) AS shipping_duration
FROM orders
WHERE shipped_at IS NOT NULL
ORDER BY days_to_ship DESC
LIMIT 15;

-- Customer signup timeline
SELECT
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS new_customers
FROM customers
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month;
```

The first query extracts individual date components. `EXTRACT(DOW FROM ...)` returns 0–6 (Sunday=0). `TO_CHAR` converts to the day name for readability.

The second query uses `DATE_TRUNC('month', ...)` to group orders by month. This is the standard pattern for time-series reporting. `DATE_TRUNC` rounds every date in a month down to the first of that month, so all March dates become `2025-03-01`.

The third query analyzes order patterns by day of week. Grouping by `DOW` reveals which days are busiest — valuable for business planning.

The fourth query computes shipping duration two ways: simple date subtraction (gives integer days) and `AGE()` (gives a human-readable interval). Both are useful depending on context.

The fifth query tracks customer growth over time using the same `DATE_TRUNC` grouping pattern on the signup timestamp.

## Alternative Solutions

PostgreSQL offers `GENERATE_SERIES` to create date ranges, useful for filling gaps in time-series data:

```sql
-- Generate all months in 2025, even those with zero orders
SELECT
    month,
    COALESCE(order_count, 0) AS order_count
FROM GENERATE_SERIES(
    '2025-01-01'::date,
    '2025-12-01'::date,
    '1 month'::interval
) AS month
LEFT JOIN (
    SELECT DATE_TRUNC('month', order_date) AS m, COUNT(*) AS order_count
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
) sub ON sub.m = month
ORDER BY month;
```

Without `GENERATE_SERIES`, months with zero orders would be missing from the results. This is a common reporting requirement.

For quarterly grouping:

```sql
SELECT
    EXTRACT(YEAR FROM order_date) AS year,
    EXTRACT(QUARTER FROM order_date) AS quarter,
    COUNT(*) AS orders,
    SUM(total_amount) AS revenue
FROM orders
GROUP BY
    EXTRACT(YEAR FROM order_date),
    EXTRACT(QUARTER FROM order_date)
ORDER BY year, quarter;
```

`EXTRACT(QUARTER FROM ...)` returns 1–4, making it easy to build quarterly reports without complex date math.
