---
id: reporting-queries
phase: 10
phase_title: Real-World SQL Challenges
sequence: 3
title: Reporting Queries
---

## Description

### Building Reports in Pure SQL

Reporting queries produce structured summaries for dashboards, exports, and executive reports. They combine aggregation, pivoting, subtotals, and formatting.

### Monthly Sales Report

A typical monthly report needs:
- Revenue per month
- Comparison to prior month
- Growth rate
- Cumulative YTD total

```
Month      Revenue    Prior Month   Change    YTD Total
─────────  ─────────  ──────────   ────────  ─────────
2024-01    $1,200     —            —         $1,200
2024-02    $1,500     $1,200       +25.0%    $2,700
2024-03    $1,100     $1,500       -26.7%    $3,800
2024-04    $1,800     $1,100       +63.6%    $5,600
```

### Pivot Tables (Cross-Tab Reports)

Transform rows into columns for category × time period reports:

```
Category     Jan     Feb     Mar     Total
──────────  ──────  ──────  ──────  ──────
Electronics  $500    $600    $450    $1,550
Clothing     $300    $350    $400    $1,050
Books        $100    $150    $120    $370

In SQL, pivoting uses CASE + SUM:
SUM(CASE WHEN month = 'Jan' THEN revenue END) AS jan
```

### Subtotals with GROUPING SETS

PostgreSQL supports `GROUPING SETS`, `ROLLUP`, and `CUBE` for multi-level subtotals:

```sql
-- ROLLUP: adds subtotals bottom-up
SELECT country, city, COUNT(*) AS customers
FROM customers
GROUP BY ROLLUP (country, city);

-- Result:
-- USA      New York    5    ← detail row
-- USA      Boston      3    ← detail row
-- USA      NULL        8    ← subtotal for USA
-- UK       London      4    ← detail row
-- UK       NULL        4    ← subtotal for UK
-- NULL     NULL       12    ← grand total
```

### Report Formatting Tips

```
Technique                    SQL Pattern
─────────────────────────   ──────────────────────────────────
Currency formatting         TO_CHAR(amount, 'FM$999,999.00')
Percentage                  ROUND(part / total * 100, 1) || '%'
Null-safe display           COALESCE(city, 'Unknown')
Conditional formatting      CASE WHEN growth > 0 THEN '+' || growth END
Ranking within report       ROW_NUMBER() OVER (ORDER BY revenue DESC)
Column totals               SUM() OVER () for grand total
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Define the report layout** → What are the rows, columns, and values?
2. **Determine the grain** → Per month? Per category? Per customer?
3. **Build aggregations** → SUM, COUNT, AVG at the right grain.
4. **Add comparisons** → LAG for prior period, window for running totals.
5. **Format for presentation** → ROUND, COALESCE, TO_CHAR.

## Starter SQL

```sql
-- Basic monthly revenue report
SELECT
    DATE_TRUNC('month', order_date)::date AS month,
    COUNT(*) AS orders,
    ROUND(SUM(total_amount), 2) AS revenue
FROM orders
WHERE total_amount IS NOT NULL
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

## Solution

```sql
-- Complete monthly sales report with MoM growth and YTD
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
    LAG(revenue) OVER (ORDER BY month) AS prior_month_revenue,
    CASE
        WHEN LAG(revenue) OVER (ORDER BY month) IS NOT NULL
        THEN ROUND(
            (revenue - LAG(revenue) OVER (ORDER BY month)) /
            LAG(revenue) OVER (ORDER BY month) * 100, 1
        )
    END AS mom_growth_pct,
    SUM(revenue) OVER (ORDER BY month) AS ytd_revenue
FROM monthly
ORDER BY month;

-- Pivot: revenue by category per month
SELECT
    cat.name AS category,
    COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM o.order_date) = 1 THEN oi.quantity * oi.unit_price END), 0) AS jan,
    COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM o.order_date) = 2 THEN oi.quantity * oi.unit_price END), 0) AS feb,
    COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM o.order_date) = 3 THEN oi.quantity * oi.unit_price END), 0) AS mar,
    COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM o.order_date) = 4 THEN oi.quantity * oi.unit_price END), 0) AS apr,
    ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total
FROM categories cat
JOIN products p ON p.category_id = cat.id
JOIN order_items oi ON oi.product_id = p.id
JOIN orders o ON o.id = oi.order_id
GROUP BY cat.id, cat.name
ORDER BY total DESC;

-- Country × status report with subtotals using ROLLUP
SELECT
    COALESCE(c.country, '** ALL COUNTRIES **') AS country,
    COALESCE(o.status, '** ALL STATUSES **') AS status,
    COUNT(*) AS order_count,
    ROUND(COALESCE(SUM(o.total_amount), 0), 2) AS revenue
FROM orders o
JOIN customers c ON c.id = o.customer_id
GROUP BY ROLLUP (c.country, o.status)
ORDER BY
    GROUPING(c.country, o.status),
    c.country NULLS LAST,
    o.status;

-- Executive dashboard: key metrics in one query
SELECT
    (SELECT COUNT(*) FROM customers) AS total_customers,
    (SELECT COUNT(*) FROM orders) AS total_orders,
    (SELECT ROUND(COALESCE(SUM(total_amount), 0), 2) FROM orders) AS total_revenue,
    (SELECT ROUND(AVG(total_amount), 2) FROM orders WHERE total_amount IS NOT NULL) AS avg_order_value,
    (SELECT COUNT(DISTINCT customer_id) FROM orders) AS customers_with_orders,
    (SELECT ROUND(
        COUNT(DISTINCT customer_id)::numeric / NULLIF((SELECT COUNT(*) FROM customers), 0) * 100, 1
    ) FROM orders) AS conversion_rate_pct;

-- Top products report with rank and % of total
WITH product_sales AS (
    SELECT
        p.name AS product,
        cat.name AS category,
        SUM(oi.quantity) AS units_sold,
        ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
    FROM products p
    JOIN categories cat ON cat.id = p.category_id
    JOIN order_items oi ON oi.product_id = p.id
    GROUP BY p.id, p.name, cat.name
)
SELECT
    ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rank,
    product,
    category,
    units_sold,
    revenue,
    ROUND(revenue / SUM(revenue) OVER () * 100, 1) AS pct_of_total,
    SUM(revenue) OVER (ORDER BY revenue DESC) AS cumulative_revenue
FROM product_sales
ORDER BY revenue DESC;
```

The first query produces a complete monthly report with prior-month comparison, growth rate, and running YTD total.

The second query creates a pivot table showing revenue per category per month. The CASE-within-SUM pattern is the standard SQL pivot technique.

The third query uses ROLLUP for automatic subtotals — totals per country, and a grand total row. COALESCE replaces NULL subtotal labels with readable text.

The fourth query produces an executive dashboard — all key metrics in a single row. This pattern is common for API-driven dashboards.

The fifth query ranks products by revenue with cumulative totals, showing a Pareto analysis (which products drive 80% of revenue).

## Alternative Solutions

PostgreSQL's `crosstab()` function (from the `tablefunc` extension) provides native pivot table support:

```sql
-- Using crosstab for true pivot (requires tablefunc extension)
-- CREATE EXTENSION IF NOT EXISTS tablefunc;

-- SELECT * FROM crosstab(
--     'SELECT cat.name, EXTRACT(MONTH FROM o.order_date)::int,
--            ROUND(SUM(oi.quantity * oi.unit_price), 2)
--      FROM categories cat
--      JOIN products p ON p.category_id = cat.id
--      JOIN order_items oi ON oi.product_id = p.id
--      JOIN orders o ON o.id = oi.order_id
--      GROUP BY cat.name, EXTRACT(MONTH FROM o.order_date)
--      ORDER BY 1, 2',
--     'SELECT generate_series(1, 12)'
-- ) AS ct(category text, jan numeric, feb numeric, ... dec numeric);
```

The CASE + SUM approach works everywhere without extensions and is more explicit about what's happening.

For dynamic pivoting (unknown number of columns), consider building the query dynamically in application code, as SQL doesn't natively support dynamic column lists.
