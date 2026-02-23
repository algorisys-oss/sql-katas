---
id: classic-sql-interview-problems
phase: 10
phase_title: Real-World SQL Challenges
sequence: 1
title: Classic SQL Interview Problems
---

## Description

### Problems That Test SQL Thinking

These are the queries that appear in technical interviews — not because they're tricky, but because they test whether you can **reason about data** rather than just recall syntax.

Each problem requires combining multiple concepts: joins, aggregation, window functions, CTEs, and set logic.

### Problem 1: Second Highest Value

"Find the second highest order amount."

This tests: subqueries, DISTINCT, LIMIT/OFFSET, and edge cases.

```
Naive approach (OFFSET):
  SELECT DISTINCT total_amount FROM orders
  ORDER BY total_amount DESC LIMIT 1 OFFSET 1;

  Problem: fails if there's only one distinct value.

Robust approach (subquery):
  SELECT MAX(total_amount)
  FROM orders
  WHERE total_amount < (SELECT MAX(total_amount) FROM orders);

  Returns NULL instead of error if there's no second value.

Window approach:
  SELECT total_amount FROM (
      SELECT total_amount, DENSE_RANK() OVER (ORDER BY total_amount DESC) AS rnk
      FROM orders WHERE total_amount IS NOT NULL
  ) ranked WHERE rnk = 2 LIMIT 1;
```

### Problem 2: Customers Who Bought Everything

"Find customers who have ordered from every product category."

This tests: relational division — one of SQL's hardest patterns.

```
Strategy:
  1. Count total categories
  2. Per customer, count distinct categories they've ordered from
  3. Keep customers where their category count = total categories

SELECT customer_id
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY customer_id
HAVING COUNT(DISTINCT p.category_id) = (SELECT COUNT(*) FROM categories);
```

### Problem 3: Year-over-Year Comparison

"Compare each month's revenue with the same month last year."

This tests: self-join or LAG on derived data.

```
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS month,
        SUM(total_amount) AS revenue
    FROM orders WHERE total_amount IS NOT NULL
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    m.month,
    m.revenue AS current_revenue,
    prev.revenue AS prev_year_revenue,
    ROUND((m.revenue - prev.revenue) / prev.revenue * 100, 1) AS yoy_change_pct
FROM monthly m
LEFT JOIN monthly prev
    ON prev.month = m.month - INTERVAL '1 year'
ORDER BY m.month;
```

### Problem 4: Find Duplicates

"Find customers with duplicate email addresses."

```
-- Self-join approach
SELECT a.id, a.email, a.first_name
FROM customers a
JOIN customers b ON a.email = b.email AND a.id != b.id;

-- GROUP BY approach (more common)
SELECT email, COUNT(*) AS count
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;

-- Window function approach (shows all duplicate rows)
SELECT * FROM (
    SELECT *, COUNT(*) OVER (PARTITION BY email) AS email_count
    FROM customers
) c WHERE email_count > 1;
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Understand what's being asked** → Translate the English question into set operations.
2. **Identify the tables needed** → Which tables hold the relevant data?
3. **Plan the joins** → How do the tables connect?
4. **Choose aggregation vs window** → Do you need to collapse rows or keep them?
5. **Handle edge cases** → NULLs, ties, empty results.

## Starter SQL

```sql
-- Problem: Find the second highest order amount
-- Try solving it, then check the solution
SELECT DISTINCT total_amount
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY total_amount DESC;
```

## Solution

```sql
-- Problem 1: Second highest order amount (three approaches)

-- Approach A: OFFSET (simple but fragile)
SELECT DISTINCT total_amount
FROM orders
WHERE total_amount IS NOT NULL
ORDER BY total_amount DESC
LIMIT 1 OFFSET 1;

-- Approach B: Subquery (robust, handles edge cases)
SELECT MAX(total_amount) AS second_highest
FROM orders
WHERE total_amount < (SELECT MAX(total_amount) FROM orders);

-- Approach C: DENSE_RANK (generalizable to Nth highest)
WITH ranked AS (
    SELECT DISTINCT total_amount,
        DENSE_RANK() OVER (ORDER BY total_amount DESC) AS rnk
    FROM orders
    WHERE total_amount IS NOT NULL
)
SELECT total_amount AS second_highest FROM ranked WHERE rnk = 2;

-- Problem 2: Customers who ordered from every category
WITH customer_categories AS (
    SELECT
        o.customer_id,
        COUNT(DISTINCT p.category_id) AS categories_ordered
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    GROUP BY o.customer_id
)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    cc.categories_ordered,
    (SELECT COUNT(*) FROM categories) AS total_categories
FROM customer_categories cc
JOIN customers c ON c.id = cc.customer_id
WHERE cc.categories_ordered = (SELECT COUNT(*) FROM categories);

-- Problem 3: Year-over-Year revenue comparison
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS month,
        ROUND(SUM(total_amount), 2) AS revenue
    FROM orders
    WHERE total_amount IS NOT NULL
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    m.month,
    m.revenue,
    prev.revenue AS prev_year_revenue,
    CASE
        WHEN prev.revenue IS NOT NULL
        THEN ROUND((m.revenue - prev.revenue) / prev.revenue * 100, 1)
    END AS yoy_change_pct
FROM monthly m
LEFT JOIN monthly prev ON prev.month = m.month - INTERVAL '1 year'
ORDER BY m.month;

-- Problem 4: Find duplicate emails
SELECT email, COUNT(*) AS occurrences
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;

-- With full customer details for each duplicate
WITH dupes AS (
    SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1
)
SELECT c.*
FROM customers c
JOIN dupes d ON d.email = c.email
ORDER BY c.email, c.id;
```

Problem 1 shows three techniques for "Nth highest." The DENSE_RANK approach generalizes to any N and handles ties correctly.

Problem 2 is relational division: "find entities that have ALL of something." The key is COUNT(DISTINCT category_id) = total categories.

Problem 3 uses a self-join on a monthly CTE, offset by 1 year. The LEFT JOIN ensures months without a prior-year counterpart still appear (with NULL for the comparison).

Problem 4 shows GROUP BY + HAVING as the standard duplicate-finding pattern, plus a variant that returns the full rows.

## Alternative Solutions

For the "second highest" problem, a correlated subquery also works:

```sql
-- Correlated subquery: count how many distinct values are larger
SELECT DISTINCT total_amount
FROM orders o1
WHERE total_amount IS NOT NULL
AND 1 = (
    SELECT COUNT(DISTINCT total_amount)
    FROM orders o2
    WHERE o2.total_amount > o1.total_amount
);
```

This finds values where exactly 1 distinct value is larger — i.e., the second highest. This generalizes: replace `1` with `N-1` for the Nth highest.
