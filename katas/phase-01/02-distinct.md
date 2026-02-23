---
id: distinct
phase: 1
phase_title: Basic SELECT
sequence: 2
title: DISTINCT
---

## Description

### Removing Duplicates

When you query a table, the result may contain duplicate rows — especially when you select only a subset of columns. `DISTINCT` removes exact duplicate rows from the result set.

```sql
-- Without DISTINCT: may have duplicate countries
SELECT country FROM customers;

-- With DISTINCT: each country appears exactly once
SELECT DISTINCT country FROM customers;
```

### When Duplicates Appear

Duplicates are a natural consequence of projection. The `customers` table has 20 rows, each with a unique `id`. But if you select only `country`, multiple customers may share the same country. The table itself has no duplicates — the duplicates emerge from your query.

### DISTINCT on Multiple Columns

When you apply `DISTINCT` to multiple columns, SQL removes rows where **all selected columns** are identical:

```sql
SELECT DISTINCT city, country FROM customers;
```

This returns unique city-country combinations. If two customers are from different cities in the same country, both rows appear.

### COUNT with DISTINCT

`COUNT(DISTINCT column)` counts the number of unique values:

```sql
SELECT COUNT(DISTINCT country) FROM customers;
```

This is different from `COUNT(country)`, which counts all non-NULL values (including duplicates).

### When NOT to Use DISTINCT

`DISTINCT` is often a **code smell** — a sign that something in your query is wrong. If you expected unique rows and got duplicates, the problem may be:

- A missing or incorrect join condition (causing row multiplication)
- Selecting too few columns to make rows unique
- Misunderstanding the data model

Before adding `DISTINCT`, always ask: *Why are there duplicates? Should I fix the query instead?*

## Schema Overview

- `customers` — id, first_name, last_name, email, city, country, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at
- `products` — id, name, category_id, price, stock_quantity, created_at

## Step-by-Step Reasoning

1. **Run without DISTINCT** — see the raw data and notice any duplicates.
2. **Add DISTINCT** — observe how the row count drops.
3. **Compare counts** — `COUNT(*)` vs `COUNT(DISTINCT column)` reveals the duplication factor.
4. **Question duplicates** — if you see duplicates, understand *why* before blindly removing them.

## Starter SQL

```sql
-- What countries do our customers come from?
SELECT DISTINCT country
FROM customers
ORDER BY country;
```

## Solution

```sql
-- Unique countries
SELECT DISTINCT country
FROM customers
ORDER BY country;

-- Unique city-country combinations
SELECT DISTINCT city, country
FROM customers
ORDER BY country, city;

-- Compare: total rows vs unique values
SELECT
    COUNT(*) AS total_customers,
    COUNT(country) AS with_country,
    COUNT(DISTINCT country) AS unique_countries,
    COUNT(DISTINCT city) AS unique_cities
FROM customers;

-- What order statuses exist?
SELECT DISTINCT status
FROM orders
ORDER BY status;

-- Which customers have placed orders? (distinct customer_ids)
SELECT DISTINCT customer_id
FROM orders
ORDER BY customer_id;
```

The first query shows all unique countries. The second adds `city` — now you see each unique city-country pair.

The comparison query reveals the duplication factor: 20 customers might span only 5 countries — that is a 4x average duplication on the `country` column.

The order status query is a practical use case: quickly discovering what values exist in a column without reading every row.

The last query finds which customers have placed at least one order. `DISTINCT` on `customer_id` gives the unique set of customers with orders. This is a preview of concepts you will explore deeper with `EXISTS` and subqueries in later phases.

## Alternative Solutions

You can achieve the same result as DISTINCT using `GROUP BY`:

```sql
-- Equivalent to SELECT DISTINCT country FROM customers
SELECT country
FROM customers
GROUP BY country
ORDER BY country;
```

`GROUP BY` without aggregation functions produces the same result as `DISTINCT`. In fact, many database engines execute them identically. The difference is intent: use `DISTINCT` when you want unique rows, use `GROUP BY` when you plan to aggregate.
