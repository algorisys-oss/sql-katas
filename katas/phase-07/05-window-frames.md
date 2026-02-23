---
id: window-frames
phase: 7
phase_title: Window Functions
sequence: 5
title: Window Frames
---

## Description

### Controlling Which Rows the Function Sees

By default, window functions with `ORDER BY` operate on rows from the start of the partition to the current row. A **window frame** lets you customize exactly which rows are included in the calculation.

```sql
-- Running total (default frame: all rows up to current)
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

### Window Frame Syntax

```sql
function() OVER (
    [PARTITION BY ...]
    ORDER BY ...
    frame_type BETWEEN frame_start AND frame_end
)
```

**Frame types:**
- `ROWS` — count physical rows
- `RANGE` — count logical value ranges
- `GROUPS` — count peer groups (PostgreSQL 11+)

**Frame boundaries:**
- `UNBOUNDED PRECEDING` — start of the partition
- `N PRECEDING` — N rows/values before current
- `CURRENT ROW` — the current row
- `N FOLLOWING` — N rows/values after current
- `UNBOUNDED FOLLOWING` — end of the partition

### Visualizing Window Frames

```
Data: 5 rows ordered by date

Row 1: [===]                                    ← frame sees row 1 only
Row 2: [=======]                                ← frame sees rows 1-2
Row 3: [===========]                            ← frame sees rows 1-3
Row 4: [===============]                        ← frame sees rows 1-4
Row 5: [===================]                    ← frame sees rows 1-5

This is ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (the default).

3-row moving window (ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING):

Row 1:    [=======]                             ← rows 1-2 (no preceding)
Row 2: [===========]                            ← rows 1-3
Row 3:    [===========]                         ← rows 2-4
Row 4:       [===========]                      ← rows 3-5
Row 5:          [=======]                       ← rows 4-5 (no following)
```

### Common Frame Patterns

**Running total** (default with ORDER BY):
```sql
SUM(amount) OVER (ORDER BY date)
-- Equivalent to:
SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
```

**Total of entire partition** (no ORDER BY, or explicit frame):
```sql
SUM(amount) OVER ()
-- Or:
SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
```

**Moving average** (3-row window):
```sql
AVG(amount) OVER (ORDER BY date ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)
```

**Cumulative to end** (current row to last):
```sql
SUM(amount) OVER (ORDER BY date ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
```

### Running Totals

The most common window frame pattern:

```sql
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total,
    COUNT(*) OVER (ORDER BY order_date) AS running_count,
    ROUND(AVG(total_amount) OVER (ORDER BY order_date), 2) AS running_avg
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;
```

Each row's `running_total` is the sum of all amounts from the first order up to and including the current row.

### Moving Averages

Smooth out fluctuations with a sliding window:

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

This computes a 3-row moving average: the current row and the 2 before it. Early rows with fewer than 3 predecessors use whatever rows are available.

### The Default Frame Trap

When you add `ORDER BY` to a window, the default frame changes:

| Syntax | Default Frame |
|--------|--------------|
| `OVER ()` | Entire partition |
| `OVER (ORDER BY ...)` | `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |

This means `SUM(...) OVER (ORDER BY date)` gives a **running sum**, not a total. If you want the full partition total with an ORDER BY, specify the frame explicitly:

```sql
-- Running sum (default frame with ORDER BY)
SUM(amount) OVER (ORDER BY date)

-- Full partition total (explicit frame overrides default)
SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
```

### ROWS vs RANGE

- `ROWS` — counts physical row positions
- `RANGE` — includes all rows with the same ORDER BY value (peers)

If multiple rows have the same date:
- `ROWS BETWEEN ... AND CURRENT ROW` — includes rows up to the current physical position
- `RANGE BETWEEN ... AND CURRENT ROW` — includes all rows with the same date as the current row

For most use cases, `ROWS` gives more predictable behavior.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Running total?** → `SUM() OVER (ORDER BY ...)` — default frame works.
2. **Moving average?** → `AVG() OVER (ORDER BY ... ROWS BETWEEN N PRECEDING AND CURRENT ROW)`.
3. **Full partition total with ORDER BY?** → Add explicit `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.
4. **Need both running and total?** → Use two window functions with different frames.

## Starter SQL

```sql
-- Running total of order amounts
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
-- Running total with percentage of final total
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total,
    SUM(total_amount) OVER () AS grand_total,
    ROUND(
        SUM(total_amount) OVER (ORDER BY order_date) /
        SUM(total_amount) OVER () * 100, 1
    ) AS pct_of_total
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;

-- 3-order moving average
SELECT
    order_date,
    total_amount,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_3,
    ROUND(AVG(total_amount) OVER (
        ORDER BY order_date
        ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_5
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY order_date;

-- Per-customer running total
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount,
    SUM(o.total_amount) OVER (
        PARTITION BY o.customer_id ORDER BY o.order_date
    ) AS customer_running_total,
    SUM(o.total_amount) OVER (
        PARTITION BY o.customer_id
    ) AS customer_lifetime_total
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.total_amount IS NOT NULL
ORDER BY c.last_name, o.order_date;

-- Monthly revenue with running total and moving average
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
    SUM(revenue) OVER (ORDER BY month) AS ytd_revenue,
    ROUND(AVG(revenue) OVER (
        ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_3m
FROM monthly
ORDER BY month;
```

The first query shows running total alongside the grand total, plus cumulative percentage. At the last row, `running_total` equals `grand_total` and `pct_of_total` reaches 100%.

The second query computes two moving averages — 3-order and 5-order — side by side. The 5-order average is smoother but responds slower to changes.

The third query uses `PARTITION BY` to compute per-customer running totals. Each customer's running total resets independently. The `customer_lifetime_total` has no ORDER BY, so it shows the full partition total.

The fourth query combines CTE aggregation with window frames for monthly analytics: year-to-date revenue and a 3-month moving average.

## Alternative Solutions

For complex analytics, you might combine multiple window functions with a named WINDOW clause:

```sql
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER w_running AS running_total,
    AVG(total_amount) OVER w_running AS running_avg,
    SUM(total_amount) OVER w_all AS grand_total,
    ROW_NUMBER() OVER w_running AS row_num
FROM orders
WHERE total_amount IS NOT NULL
WINDOW
    w_running AS (ORDER BY order_date),
    w_all AS ()
ORDER BY order_date;
```

Named windows keep complex queries readable when multiple frame definitions are in play.
