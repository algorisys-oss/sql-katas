---
id: group-by
phase: 3
phase_title: Aggregation & GROUP BY
sequence: 2
title: GROUP BY
---

## Description

### From One Summary to Many

In the previous kata, aggregate functions collapsed an entire table into a **single row**. But most real questions need summaries **per group**:

- How many orders **per customer**?
- What is the average price **per category**?
- How much revenue **per month**?

`GROUP BY` answers these questions by partitioning rows into groups, then applying aggregate functions to each group independently.

### How GROUP BY Works

Think of `GROUP BY` as a three-step process:

1. **Partition** — divide all rows into groups based on the column(s) you specify
2. **Aggregate** — apply aggregate functions within each group
3. **Return** — output one row per group

```sql
SELECT category_id, COUNT(*) AS product_count
FROM products
GROUP BY category_id;
```

This query:
1. Takes all rows from `products`
2. Groups them by `category_id` (all products with `category_id = 1` in one group, `category_id = 2` in another, etc.)
3. Counts the rows in each group
4. Returns one row per category

### The Golden Rule

> Every column in `SELECT` must either be in the `GROUP BY` clause or inside an aggregate function.

This is not a suggestion — it is a hard rule enforced by the database.

```sql
-- VALID: category_id is in GROUP BY, COUNT is an aggregate
SELECT category_id, COUNT(*) FROM products GROUP BY category_id;

-- INVALID: name is not in GROUP BY and not aggregated
SELECT category_id, name, COUNT(*) FROM products GROUP BY category_id;
```

Why? When you group by `category_id`, each group may contain many different `name` values. SQL cannot pick one — it does not know which `name` you want. You must either:
- Add `name` to `GROUP BY` (creating finer groups)
- Aggregate it: `MIN(name)`, `MAX(name)`, `STRING_AGG(name, ', ')`

### Grouping by Multiple Columns

You can group by more than one column. This creates groups for each unique **combination** of values:

```sql
SELECT country, status, COUNT(*) AS order_count
FROM customers
JOIN orders ON orders.customer_id = customers.id
GROUP BY country, status;
```

Each unique pair of `(country, status)` becomes its own group. You might see rows like:
- `US, delivered, 18`
- `US, pending, 3`
- `UK, delivered, 4`

### GROUP BY with Expressions

You can group by expressions, not just column names:

```sql
-- Group orders by month
SELECT
    DATE_TRUNC('month', order_date) AS order_month,
    COUNT(*) AS orders_in_month
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY order_month;
```

In PostgreSQL, you can also use column position numbers as a shorthand:

```sql
-- Same query using positional reference
SELECT
    DATE_TRUNC('month', order_date) AS order_month,
    COUNT(*) AS orders_in_month
FROM orders
GROUP BY 1
ORDER BY 1;
```

The `1` refers to the first expression in `SELECT`. This is convenient but can reduce clarity in complex queries.

### NULL in GROUP BY

NULLs are treated as equal to each other for grouping purposes. All rows with `NULL` in the grouped column form a single group:

```sql
SELECT city, COUNT(*) AS customer_count
FROM customers
GROUP BY city
ORDER BY customer_count DESC;
```

Customers with `NULL` city will appear as a single group. This is one of the rare cases where SQL treats NULLs as "the same."

### Execution Order

Remember SQL's logical execution order:

1. `FROM` — identify the table
2. `WHERE` — filter rows (before grouping)
3. **`GROUP BY`** — partition into groups
4. `SELECT` — compute aggregates and choose columns
5. `ORDER BY` — sort the result

`WHERE` filters individual rows **before** grouping. This means you can reduce the data set before any aggregation happens.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What groups do you need?** — Identify the column(s) that define your groups (per category, per customer, per month).
2. **What summary do you need per group?** — Choose the aggregate function (count, sum, average, etc.).
3. **Do you need to filter first?** — Use `WHERE` to exclude irrelevant rows before grouping.
4. **Check the golden rule** — every non-aggregated column in `SELECT` must be in `GROUP BY`.
5. **Order the result** — typically by the aggregate (highest first) or by the grouping column.

## Starter SQL

```sql
-- Count products in each category
SELECT
    category_id,
    COUNT(*) AS product_count
FROM products
GROUP BY category_id
ORDER BY product_count DESC;
```

## Solution

```sql
-- Products per category with price stats
SELECT
    category_id,
    COUNT(*) AS product_count,
    ROUND(MIN(price), 2) AS cheapest,
    ROUND(MAX(price), 2) AS most_expensive,
    ROUND(AVG(price), 2) AS avg_price
FROM products
GROUP BY category_id
ORDER BY product_count DESC;

-- Orders per status
SELECT
    status,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS total_revenue,
    ROUND(AVG(total_amount), 2) AS avg_value
FROM orders
GROUP BY status
ORDER BY order_count DESC;

-- Customers per country
SELECT
    country,
    COUNT(*) AS customer_count,
    COUNT(city) AS with_known_city,
    COUNT(*) - COUNT(city) AS with_unknown_city
FROM customers
GROUP BY country
ORDER BY customer_count DESC;

-- Orders per month (time-series grouping)
SELECT
    DATE_TRUNC('month', order_date)::date AS order_month,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS monthly_revenue
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY order_month;

-- Most ordered products (GROUP BY with filtering)
SELECT
    product_id,
    SUM(quantity) AS total_quantity_sold,
    ROUND(SUM(quantity * unit_price), 2) AS total_revenue
FROM order_items
GROUP BY product_id
ORDER BY total_quantity_sold DESC;
```

The first query groups products by category and computes price statistics per group. Each category becomes one row in the output.

The second query shows the distribution of order statuses. Notice that `SUM` and `AVG` ignore NULLs in `total_amount` — cancelled orders with NULL amounts do not distort the averages.

The third query demonstrates using `COUNT(*)` vs `COUNT(column)` within groups to find how many customers in each country have unknown cities.

The fourth query groups by a date expression. `DATE_TRUNC('month', order_date)` rounds each date down to the first of its month, creating monthly buckets. The `::date` cast formats the output cleanly.

The fifth query groups order items by product to find which products sell the most units and generate the most revenue.

## Alternative Solutions

When you need the category name instead of just the ID, you must join before grouping:

```sql
SELECT
    c.name AS category_name,
    COUNT(*) AS product_count,
    ROUND(AVG(p.price), 2) AS avg_price,
    SUM(p.stock_quantity) AS total_stock
FROM products p
JOIN categories c ON c.id = p.category_id
GROUP BY c.name
ORDER BY product_count DESC;
```

The `JOIN` happens in the `FROM` phase (step 1), before `GROUP BY` (step 3). This means you can group by columns from any joined table.

For grouping by multiple columns simultaneously:

```sql
-- Order count per customer per status
SELECT
    customer_id,
    status,
    COUNT(*) AS order_count
FROM orders
GROUP BY customer_id, status
ORDER BY customer_id, order_count DESC;
```

Each unique `(customer_id, status)` pair becomes its own group. This gives you a detailed breakdown: how many delivered orders per customer, how many pending, etc.
