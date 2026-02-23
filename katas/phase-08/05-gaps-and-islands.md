---
id: gaps-and-islands
phase: 8
phase_title: Advanced Window & Analytical Queries
sequence: 5
title: Gaps and Islands
---

## Description

### Finding Consecutive Groups

The **gaps and islands** problem finds consecutive sequences ("islands") in data and the gaps between them. Examples:

- Consecutive days a customer placed orders
- Consecutive months with revenue above a threshold
- Consecutive order statuses (e.g., a streak of delivered orders)

### The Core Technique

The trick: if you have a sequence and subtract a row number, consecutive values produce the **same difference** — forming a group identifier.

```
Value:        1  2  3  5  6  8  9  10
ROW_NUMBER:   1  2  3  4  5  6  7   8
Difference:   0  0  0  1  1  2  2   2
              └──┬──┘  └─┬─┘  └──┬──┘
              Island 1  Island 2  Island 3
```

### Visualizing the Algorithm

```
Order dates for a customer:
2024-02-01, 2024-02-02, 2024-02-03, 2024-02-10, 2024-02-11, 2024-02-20

Step 1: Assign row numbers
Date         RN
2024-02-01    1
2024-02-02    2
2024-02-03    3
2024-02-10    4
2024-02-11    5
2024-02-20    6

Step 2: Subtract (date - row_number in days)
Date         RN    Date - RN days
2024-02-01    1    2024-01-31
2024-02-02    2    2024-01-31  ← same!
2024-02-03    3    2024-01-31  ← same! (island 1)
2024-02-10    4    2024-02-06
2024-02-11    5    2024-02-06  ← same! (island 2)
2024-02-20    6    2024-02-14  (island 3)

Step 3: GROUP BY the difference to find islands
Island 1: 2024-02-01 to 2024-02-03 (3 consecutive days)
Island 2: 2024-02-10 to 2024-02-11 (2 consecutive days)
Island 3: 2024-02-20 (1 day)
```

### Status Streaks

For non-date sequences, use `ROW_NUMBER` within status groups:

```sql
WITH numbered AS (
    SELECT
        customer_id,
        order_date,
        status,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS rn_all,
        ROW_NUMBER() OVER (PARTITION BY customer_id, status ORDER BY order_date) AS rn_status
    FROM orders
)
SELECT
    customer_id,
    status,
    rn_all - rn_status AS island_id,
    COUNT(*) AS streak_length,
    MIN(order_date) AS streak_start,
    MAX(order_date) AS streak_end
FROM numbered
GROUP BY customer_id, status, rn_all - rn_status
ORDER BY customer_id, streak_start;
```

The difference `rn_all - rn_status` is constant for consecutive rows with the same status.

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What defines "consecutive"?** → Sequential dates, sequential numbers, or same status in order.
2. **Assign two row numbers** → One for overall ordering, one per category/status.
3. **Subtract them** → The difference is constant within an island.
4. **Group by the difference** → Each group is one island.
5. **Aggregate per island** → MIN/MAX for boundaries, COUNT for length.

## Starter SQL

```sql
-- Status streaks per customer
WITH numbered AS (
    SELECT
        customer_id,
        order_date,
        status,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS rn_all,
        ROW_NUMBER() OVER (PARTITION BY customer_id, status ORDER BY order_date) AS rn_status
    FROM orders
)
SELECT
    customer_id,
    status,
    COUNT(*) AS streak_length,
    MIN(order_date) AS streak_start,
    MAX(order_date) AS streak_end
FROM numbered
GROUP BY customer_id, status, rn_all - rn_status
HAVING COUNT(*) > 1
ORDER BY customer_id, streak_start;
```

## Solution

```sql
-- Find consecutive order status streaks per customer
WITH numbered AS (
    SELECT
        customer_id,
        id AS order_id,
        order_date,
        status,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS rn_all,
        ROW_NUMBER() OVER (PARTITION BY customer_id, status ORDER BY order_date) AS rn_status
    FROM orders
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    n.status,
    COUNT(*) AS streak_length,
    MIN(n.order_date) AS streak_start,
    MAX(n.order_date) AS streak_end
FROM numbered n
JOIN customers c ON c.id = n.customer_id
GROUP BY c.id, c.first_name, c.last_name, n.status, n.rn_all - n.rn_status
ORDER BY c.last_name, streak_start;

-- Monthly revenue: find months above/below average (islands)
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS month,
        ROUND(SUM(total_amount), 2) AS revenue
    FROM orders
    WHERE total_amount IS NOT NULL
    GROUP BY DATE_TRUNC('month', order_date)
),
classified AS (
    SELECT
        month,
        revenue,
        CASE WHEN revenue > (SELECT AVG(revenue) FROM monthly) THEN 'above' ELSE 'below' END AS position,
        ROW_NUMBER() OVER (ORDER BY month) AS rn_all,
        ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN revenue > (SELECT AVG(revenue) FROM monthly) THEN 'above' ELSE 'below' END
            ORDER BY month
        ) AS rn_position
    FROM monthly
)
SELECT
    position,
    COUNT(*) AS consecutive_months,
    MIN(month) AS period_start,
    MAX(month) AS period_end,
    ROUND(AVG(revenue), 2) AS avg_revenue_in_period
FROM classified
GROUP BY position, rn_all - rn_position
ORDER BY period_start;

-- Find gaps: months with no orders at all
WITH all_months AS (
    SELECT generate_series(
        (SELECT DATE_TRUNC('month', MIN(order_date)) FROM orders),
        (SELECT DATE_TRUNC('month', MAX(order_date)) FROM orders),
        '1 month'
    )::date AS month
),
months_with_orders AS (
    SELECT DISTINCT DATE_TRUNC('month', order_date)::date AS month
    FROM orders
)
SELECT am.month AS gap_month
FROM all_months am
LEFT JOIN months_with_orders mwo ON mwo.month = am.month
WHERE mwo.month IS NULL
ORDER BY am.month;
```

The first query finds all consecutive streaks of the same order status per customer. A customer with orders: delivered, delivered, shipped, delivered would have three streaks.

The second query classifies months as above or below average revenue, then finds consecutive runs of above-average or below-average months. This reveals sustained trends.

The third query takes a different approach: instead of finding islands, it finds **gaps** — months where no orders occurred at all. It generates all months in the range, then anti-joins with actual order months.

## Alternative Solutions

An alternative to the row-number subtraction technique uses `LAG` to detect island boundaries:

```sql
-- LAG-based island detection
WITH flagged AS (
    SELECT
        customer_id, order_date, status,
        CASE
            WHEN status != LAG(status) OVER (PARTITION BY customer_id ORDER BY order_date)
            OR LAG(status) OVER (PARTITION BY customer_id ORDER BY order_date) IS NULL
            THEN 1 ELSE 0
        END AS new_island
    FROM orders
),
islands AS (
    SELECT *,
        SUM(new_island) OVER (PARTITION BY customer_id ORDER BY order_date) AS island_id
    FROM flagged
)
SELECT
    customer_id, status,
    COUNT(*) AS streak_length,
    MIN(order_date) AS streak_start,
    MAX(order_date) AS streak_end
FROM islands
GROUP BY customer_id, status, island_id
ORDER BY customer_id, streak_start;
```

This is essentially the sessionization technique applied to status changes instead of time gaps. Both approaches work; the row-number subtraction is more concise, while the LAG-based approach is more explicit about what triggers a new island.
