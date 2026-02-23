---
id: lag-lead
phase: 7
phase_title: Window Functions
sequence: 4
title: LAG and LEAD
---

## Description

### Looking at Neighboring Rows

`LAG` and `LEAD` let you access values from **previous** or **next** rows without a self-join. They are essential for time-series analysis, change detection, and sequential comparisons.

```sql
-- Each order with the previous order's date
SELECT
    id,
    order_date,
    total_amount,
    LAG(order_date) OVER (ORDER BY order_date) AS prev_order_date
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

### How LAG and LEAD Work

```
LAG: look backward                    LEAD: look forward
┌───────┬────────────┬──────────┐     ┌───────┬────────────┬──────────┐
│ row   │ order_date │ LAG()    │     │ row   │ order_date │ LEAD()   │
├───────┼────────────┼──────────┤     ├───────┼────────────┼──────────┤
│   1   │ 2024-02-01 │ NULL     │←no  │   1   │ 2024-02-01 │ 2024-02-10│→row 2
│   2   │ 2024-02-10 │ 2024-02-01│←1  │   2   │ 2024-02-10 │ 2024-02-15│→row 3
│   3   │ 2024-02-15 │ 2024-02-10│←2  │   3   │ 2024-02-15 │ 2024-02-20│→row 4
│   4   │ 2024-02-20 │ 2024-02-15│←3  │   4   │ 2024-02-20 │ NULL     │→no
└───────┴────────────┴──────────┘     └───────┴────────────┴──────────┘
    prev row                                                next row
```

- `LAG(column)` — value from the **previous** row
- `LEAD(column)` — value from the **next** row
- First row's LAG is NULL (no previous row)
- Last row's LEAD is NULL (no next row)

### Syntax

```sql
LAG(column, offset, default) OVER (ORDER BY ...)
LEAD(column, offset, default) OVER (ORDER BY ...)
```

- `column` — the value to retrieve
- `offset` — how many rows back/forward (default: 1)
- `default` — value when there is no previous/next row (default: NULL)

```sql
-- Look back 2 rows, default to 0 if no row exists
LAG(total_amount, 2, 0) OVER (ORDER BY order_date)
```

### Computing Differences Between Rows

The classic pattern — calculate change from one row to the next:

```sql
SELECT
    id,
    order_date,
    total_amount,
    LAG(total_amount) OVER (ORDER BY order_date) AS prev_amount,
    total_amount - LAG(total_amount) OVER (ORDER BY order_date) AS change
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

### LAG/LEAD with PARTITION BY

Compute differences **within groups**:

```sql
-- Each customer's order-over-order change
SELECT
    customer_id,
    order_date,
    total_amount,
    LAG(total_amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS prev_amount,
    total_amount - LAG(total_amount) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS change
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY customer_id, order_date;
```

The LAG only looks at the previous row **within the same customer**. Each customer's first order has NULL for `prev_amount`.

### Days Between Events

```sql
SELECT
    customer_id,
    order_date,
    LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date) AS prev_date,
    order_date - LAG(order_date) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS days_between
FROM orders
ORDER BY customer_id, order_date;
```

This computes the gap in days between consecutive orders for each customer — essential for churn analysis and engagement metrics.

### FIRST_VALUE and LAST_VALUE

Related functions that return the first or last value in the window:

```sql
SELECT
    name,
    price,
    FIRST_VALUE(name) OVER (ORDER BY price DESC) AS most_expensive,
    LAST_VALUE(name) OVER (
        ORDER BY price DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS cheapest
FROM products;
```

Note: `LAST_VALUE` requires an explicit window frame (`ROWS BETWEEN ... AND UNBOUNDED FOLLOWING`) to see the last row. The default frame only extends to the current row.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Need to compare with previous row?** → `LAG(column) OVER (ORDER BY ...)`.
2. **Need to compare with next row?** → `LEAD(column) OVER (ORDER BY ...)`.
3. **Within groups?** → Add `PARTITION BY`.
4. **Handle NULLs at boundaries** → Use the third argument: `LAG(col, 1, default_value)`.
5. **Computing differences** → `column - LAG(column) OVER (...)`.

## Starter SQL

```sql
-- Orders with days since previous order
SELECT
    id,
    customer_id,
    order_date,
    LAG(order_date) OVER (ORDER BY order_date) AS prev_order_date,
    order_date - LAG(order_date) OVER (ORDER BY order_date) AS days_gap
FROM orders
ORDER BY order_date;
```

## Solution

```sql
-- Order-over-order amount change (global)
SELECT
    id,
    order_date,
    total_amount,
    LAG(total_amount) OVER (ORDER BY order_date) AS prev_amount,
    ROUND(total_amount - LAG(total_amount) OVER (ORDER BY order_date), 2) AS change,
    LEAD(total_amount) OVER (ORDER BY order_date) AS next_amount
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;

-- Per-customer: days between orders and amount trend
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount,
    LAG(o.order_date) OVER w AS prev_date,
    o.order_date - LAG(o.order_date) OVER w AS days_between,
    LAG(o.total_amount) OVER w AS prev_amount,
    ROUND(o.total_amount - LAG(o.total_amount) OVER w, 2) AS amount_change
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.total_amount IS NOT NULL
WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.order_date)
ORDER BY c.last_name, o.order_date;

-- Monthly order trend: month-over-month change
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
    LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue,
    ROUND(revenue - LAG(revenue) OVER (ORDER BY month), 2) AS revenue_change,
    CASE
        WHEN LAG(revenue) OVER (ORDER BY month) IS NOT NULL
        THEN ROUND((revenue - LAG(revenue) OVER (ORDER BY month))
             / LAG(revenue) OVER (ORDER BY month) * 100, 1)
    END AS pct_change
FROM monthly
ORDER BY month;

-- Product price ranking with neighbors
SELECT
    name,
    price,
    LAG(name) OVER (ORDER BY price DESC) AS more_expensive,
    LEAD(name) OVER (ORDER BY price DESC) AS less_expensive
FROM products
ORDER BY price DESC;
```

The first query shows global LAG and LEAD together — each order sees its predecessor and successor.

The second query uses the `WINDOW` clause (a PostgreSQL feature) to define a named window `w` that is reused across multiple window functions. This avoids repeating the same `OVER (PARTITION BY ... ORDER BY ...)` clause.

The third query demonstrates a real analytics pattern: month-over-month revenue change with percentage. LAG compares each month to the previous month.

The fourth query uses LAG/LEAD creatively to show each product's price neighbors — which product is just above and just below in price.

## Alternative Solutions

The named `WINDOW` clause reduces repetition when multiple functions use the same window:

```sql
-- Without WINDOW clause (repetitive)
SELECT
    order_date,
    total_amount,
    LAG(total_amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS prev,
    LEAD(total_amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS next
FROM orders;

-- With WINDOW clause (DRY)
SELECT
    order_date,
    total_amount,
    LAG(total_amount) OVER w AS prev,
    LEAD(total_amount) OVER w AS next
FROM orders
WINDOW w AS (PARTITION BY customer_id ORDER BY order_date);
```

Both produce the same result. The `WINDOW` clause is cleaner when you have 3+ window functions sharing the same definition.
