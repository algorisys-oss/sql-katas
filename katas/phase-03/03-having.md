---
id: having
phase: 3
phase_title: Aggregation & GROUP BY
sequence: 3
title: HAVING
---

## Description

### Filtering After Grouping

`WHERE` filters individual rows **before** grouping. But what if you want to filter **groups** based on their aggregate values?

That is what `HAVING` does.

```sql
-- Find categories with more than 5 products
SELECT category_id, COUNT(*) AS product_count
FROM products
GROUP BY category_id
HAVING COUNT(*) > 5;
```

`HAVING` runs **after** `GROUP BY`. It sees the aggregated results and keeps only the groups that match the condition.

### WHERE vs HAVING

This is the critical distinction:

| Clause | Filters | Runs | Can Use Aggregates? |
|--------|---------|------|---------------------|
| `WHERE` | Individual rows | Before `GROUP BY` | No |
| `HAVING` | Groups | After `GROUP BY` | Yes |

```sql
-- WHERE: exclude cancelled orders before grouping
-- HAVING: only show customers with 3+ remaining orders
SELECT
    customer_id,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS total_spent
FROM orders
WHERE status != 'cancelled'
GROUP BY customer_id
HAVING COUNT(*) >= 3
ORDER BY total_spent DESC;
```

The execution order is:

1. `FROM orders` — start with all orders
2. `WHERE status != 'cancelled'` — remove cancelled orders
3. `GROUP BY customer_id` — group remaining orders by customer
4. `HAVING COUNT(*) >= 3` — keep only groups with 3 or more orders
5. `SELECT` — compute the final columns
6. `ORDER BY` — sort by total spent

### Common Mistake: Using WHERE for Aggregates

This will **not** work:

```sql
-- WRONG: WHERE cannot use aggregate functions
SELECT customer_id, COUNT(*)
FROM orders
WHERE COUNT(*) >= 3
GROUP BY customer_id;
```

The error occurs because `WHERE` runs before `GROUP BY`. At that point, groups do not exist yet, so `COUNT(*)` has no meaning. Use `HAVING` instead.

### HAVING Without GROUP BY

Technically, `HAVING` can be used without `GROUP BY`. In that case, the entire result set is treated as one group:

```sql
-- Only return a result if there are more than 40 orders total
SELECT COUNT(*) AS total_orders, ROUND(AVG(total_amount), 2) AS avg_value
FROM orders
HAVING COUNT(*) > 40;
```

If the condition is false, the query returns **zero rows**. This is rarely used in practice but helps illustrate that `HAVING` always operates on groups.

### Multiple HAVING Conditions

You can combine multiple conditions in `HAVING` with `AND` and `OR`:

```sql
SELECT
    customer_id,
    COUNT(*) AS order_count,
    ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders
WHERE status = 'delivered'
GROUP BY customer_id
HAVING COUNT(*) >= 2 AND AVG(total_amount) > 50
ORDER BY avg_order_value DESC;
```

This finds customers who have at least 2 delivered orders **and** whose average order value exceeds $50. Both conditions must be true for the group to be included.

### Performance Consideration

`WHERE` is almost always more efficient than `HAVING` for the same filter. If you can filter rows before grouping, do it with `WHERE`:

```sql
-- GOOD: filter rows first, then group
SELECT category_id, AVG(price) AS avg_price
FROM products
WHERE price > 0
GROUP BY category_id;

-- BAD: group all rows, then filter (processes more data)
SELECT category_id, AVG(price) AS avg_price
FROM products
GROUP BY category_id
HAVING AVG(price) > 0;
```

These queries do different things, but the principle holds: push row-level filters into `WHERE` and reserve `HAVING` for conditions that genuinely need aggregate values.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Do you need to filter individual rows?** — Use `WHERE` (before grouping).
2. **Group the remaining rows** — Use `GROUP BY` on the appropriate column(s).
3. **Do you need to filter groups?** — Use `HAVING` with an aggregate condition.
4. **Remember the order** — `WHERE` → `GROUP BY` → `HAVING`. Never use aggregates in `WHERE`.

## Starter SQL

```sql
-- Find customers who have placed at least 3 orders
SELECT
    customer_id,
    COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3
ORDER BY order_count DESC;
```

## Solution

```sql
-- Categories with more than 3 products
SELECT
    category_id,
    COUNT(*) AS product_count,
    ROUND(AVG(price), 2) AS avg_price
FROM products
GROUP BY category_id
HAVING COUNT(*) > 3
ORDER BY product_count DESC;

-- High-value customers: delivered orders only, 2+ orders, $100+ average
SELECT
    customer_id,
    COUNT(*) AS delivered_orders,
    ROUND(SUM(total_amount), 2) AS total_spent,
    ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders
WHERE status = 'delivered'
GROUP BY customer_id
HAVING COUNT(*) >= 2 AND AVG(total_amount) > 100
ORDER BY total_spent DESC;

-- Products ordered in large total quantities
SELECT
    product_id,
    SUM(quantity) AS total_units_sold,
    COUNT(DISTINCT order_id) AS number_of_orders
FROM order_items
GROUP BY product_id
HAVING SUM(quantity) > 1
ORDER BY total_units_sold DESC;

-- Months with significant order volume
SELECT
    DATE_TRUNC('month', order_date)::date AS order_month,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS monthly_revenue
FROM orders
WHERE total_amount IS NOT NULL
GROUP BY DATE_TRUNC('month', order_date)
HAVING COUNT(*) >= 5
ORDER BY order_month;

-- Countries with multiple customers and high city coverage
SELECT
    country,
    COUNT(*) AS total_customers,
    COUNT(city) AS with_city,
    ROUND(COUNT(city)::numeric / COUNT(*) * 100, 1) AS city_coverage_pct
FROM customers
GROUP BY country
HAVING COUNT(*) >= 2
ORDER BY total_customers DESC;
```

The first query finds categories with more than 3 products. `HAVING COUNT(*) > 3` filters out small categories after grouping.

The second query combines `WHERE` and `HAVING`: `WHERE` excludes non-delivered orders before grouping, then `HAVING` keeps only customers with 2+ orders and a high average value. This layered filtering is the most common real-world pattern.

The third query groups order items by product and keeps only products with total units sold greater than 1. `COUNT(DISTINCT order_id)` tells you how many separate orders included that product.

The fourth query filters out NULL amounts with `WHERE` (row-level), groups by month, then uses `HAVING` to show only months with 5 or more orders.

The fifth query computes city data coverage per country. The `HAVING COUNT(*) >= 2` filter ensures we only see countries with meaningful sample sizes. The percentage calculation uses `::numeric` to avoid integer division.

## Alternative Solutions

You can reference column aliases in `HAVING` in PostgreSQL (this is a PostgreSQL extension — not standard SQL):

```sql
-- PostgreSQL allows this (non-standard)
SELECT
    customer_id,
    COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING order_count >= 3;
```

In standard SQL, you must repeat the aggregate expression:

```sql
-- Standard SQL (works everywhere)
SELECT
    customer_id,
    COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3;
```

For complex filtering, you can combine `WHERE`, `HAVING`, and `ORDER BY` with `LIMIT` to answer precise business questions:

```sql
-- Top 5 customers by revenue (excluding cancelled, minimum 2 orders)
SELECT
    customer_id,
    COUNT(*) AS order_count,
    ROUND(SUM(total_amount), 2) AS total_revenue
FROM orders
WHERE status != 'cancelled' AND total_amount IS NOT NULL
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY total_revenue DESC
LIMIT 5;
```

This follows the full execution pipeline: filter rows → group → filter groups → sort → limit. Each clause does its job at the right stage.
