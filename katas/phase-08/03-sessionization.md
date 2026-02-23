---
id: sessionization
phase: 8
phase_title: Advanced Window & Analytical Queries
sequence: 3
title: Sessionization
---

## Description

### Grouping Events into Sessions

**Sessionization** is the process of dividing a sequence of events into logical groups (sessions) based on time gaps. If two events are close together, they belong to the same session. If there is a long gap, a new session starts.

This is a core pattern in web analytics, user behavior analysis, and activity tracking.

### The Algorithm

1. Order events by time
2. Compute the gap between each event and the previous one
3. If the gap exceeds a threshold, mark it as a new session
4. Assign session IDs using a running sum of new-session markers

### Step-by-Step with SQL

```sql
-- Step 1 & 2: Compute gaps between orders per customer
WITH order_gaps AS (
    SELECT
        customer_id,
        id AS order_id,
        order_date,
        LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS prev_date,
        order_date - LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS days_gap
    FROM orders
),
-- Step 3: Mark new sessions (gap > 60 days)
session_markers AS (
    SELECT
        *,
        CASE WHEN days_gap IS NULL OR days_gap > 60 THEN 1 ELSE 0 END AS new_session
    FROM order_gaps
),
-- Step 4: Assign session IDs with running sum
sessions AS (
    SELECT
        *,
        SUM(new_session) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS session_id
    FROM session_markers
)
SELECT customer_id, order_id, order_date, days_gap, session_id
FROM sessions
ORDER BY customer_id, order_date;
```

### Visualizing Sessionization

```
Customer Alice's orders (threshold: 60 days):

Order Date    Gap    New Session?   Session ID
2024-02-01    NULL   YES (first)    1
2024-03-15    43d    NO             1     ← same session
2024-06-01    78d    YES (>60)      2     ← new session!
2024-07-10    39d    NO             2     ← same session

The running sum of new_session flags creates the session_id:
  SUM(1, 0, 1, 0) → cumulative: 1, 1, 2, 2
```

### Session-Level Analytics

Once you have session IDs, aggregate per session:

```sql
WITH order_gaps AS (
    SELECT
        customer_id, id AS order_id, order_date,
        order_date - LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS days_gap
    FROM orders
),
sessions AS (
    SELECT *,
        SUM(CASE WHEN days_gap IS NULL OR days_gap > 60 THEN 1 ELSE 0 END) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS session_id
    FROM order_gaps
)
SELECT
    customer_id,
    session_id,
    COUNT(*) AS orders_in_session,
    MIN(order_date) AS session_start,
    MAX(order_date) AS session_end,
    MAX(order_date) - MIN(order_date) AS session_duration_days
FROM sessions
GROUP BY customer_id, session_id
ORDER BY customer_id, session_id;
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Order events chronologically** within each entity (customer, user).
2. **Compute the gap** using `LAG()`.
3. **Define the threshold** — what gap starts a new session?
4. **Mark new sessions** — `CASE WHEN gap > threshold THEN 1 ELSE 0 END`.
5. **Assign session IDs** — running sum of the new-session markers.
6. **Aggregate per session** — GROUP BY entity + session_id.

## Starter SQL

```sql
-- Compute order gaps per customer
SELECT
    customer_id,
    order_date,
    LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date) AS prev_date,
    order_date - LAG(order_date) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS days_gap
FROM orders
ORDER BY customer_id, order_date;
```

## Solution

```sql
-- Full sessionization with 60-day threshold
WITH order_gaps AS (
    SELECT
        customer_id, id AS order_id, order_date, total_amount,
        order_date - LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS days_gap
    FROM orders
),
sessions AS (
    SELECT *,
        SUM(CASE WHEN days_gap IS NULL OR days_gap > 60 THEN 1 ELSE 0 END) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS session_id
    FROM order_gaps
)
SELECT customer_id, order_id, order_date, days_gap, total_amount, session_id
FROM sessions
ORDER BY customer_id, order_date;

-- Session-level summary
WITH order_gaps AS (
    SELECT
        customer_id, id AS order_id, order_date, total_amount,
        order_date - LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS days_gap
    FROM orders
),
sessions AS (
    SELECT *,
        SUM(CASE WHEN days_gap IS NULL OR days_gap > 60 THEN 1 ELSE 0 END) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS session_id
    FROM order_gaps
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    s.session_id,
    COUNT(*) AS orders_in_session,
    MIN(s.order_date) AS session_start,
    MAX(s.order_date) AS session_end,
    ROUND(COALESCE(SUM(s.total_amount), 0), 2) AS session_revenue
FROM sessions s
JOIN customers c ON c.id = s.customer_id
GROUP BY c.id, c.first_name, c.last_name, s.session_id
ORDER BY c.last_name, s.session_id;

-- Customer engagement: sessions per customer and avg session size
WITH order_gaps AS (
    SELECT customer_id, order_date,
        order_date - LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS days_gap
    FROM orders
),
sessions AS (
    SELECT *,
        SUM(CASE WHEN days_gap IS NULL OR days_gap > 60 THEN 1 ELSE 0 END) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS session_id
    FROM order_gaps
),
session_stats AS (
    SELECT customer_id, session_id, COUNT(*) AS orders_in_session
    FROM sessions GROUP BY customer_id, session_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(*) AS total_sessions,
    ROUND(AVG(orders_in_session), 1) AS avg_orders_per_session,
    MAX(orders_in_session) AS max_orders_in_session
FROM session_stats ss
JOIN customers c ON c.id = ss.customer_id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY total_sessions DESC;
```

The first query shows the full sessionization pipeline: gaps, markers, and session IDs at the order level.

The second query aggregates sessions to show start date, end date, order count, and revenue per session per customer.

The third query goes one level higher: how many sessions does each customer have, and how big are they on average?

## Alternative Solutions

The threshold value (60 days) is a business decision. You can parameterize it or experiment with different values:

```sql
-- Compare different thresholds
WITH order_gaps AS (
    SELECT customer_id, order_date,
        order_date - LAG(order_date) OVER (
            PARTITION BY customer_id ORDER BY order_date
        ) AS days_gap
    FROM orders
)
SELECT
    customer_id,
    order_date,
    days_gap,
    SUM(CASE WHEN days_gap IS NULL OR days_gap > 30 THEN 1 ELSE 0 END) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS session_30d,
    SUM(CASE WHEN days_gap IS NULL OR days_gap > 60 THEN 1 ELSE 0 END) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS session_60d,
    SUM(CASE WHEN days_gap IS NULL OR days_gap > 90 THEN 1 ELSE 0 END) OVER (
        PARTITION BY customer_id ORDER BY order_date
    ) AS session_90d
FROM order_gaps
ORDER BY customer_id, order_date;
```

Shorter thresholds create more sessions (stricter engagement criteria). Longer thresholds merge more activity into single sessions.
