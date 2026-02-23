---
id: select-from-where
phase: 1
phase_title: Basic SELECT
sequence: 1
title: SELECT, FROM, WHERE
---

## Description

### The Foundation of Every Query

Every SQL query you will ever write uses the same three clauses:

- **SELECT** — which columns do you want?
- **FROM** — which table are they in?
- **WHERE** — which rows do you want?

These three clauses are the backbone of SQL. Everything else — joins, aggregations, window functions — builds on top of this foundation.

### SELECT: Choosing Columns

`SELECT` controls what appears in your result. You can:

- Select all columns: `SELECT *`
- Select specific columns: `SELECT first_name, email`
- Rename columns: `SELECT first_name AS name`
- Compute new columns: `SELECT price * quantity AS total`

When you select specific columns instead of `*`, you are performing a **projection** — reducing the data to only the fields you need. This is fundamental: production queries should almost never use `SELECT *` because it fetches unnecessary data and creates brittle code that breaks when columns are added or reordered.

### FROM: Choosing the Table

`FROM` specifies where the data lives. In simple queries, it names a single table:

```sql
SELECT name, price FROM products;
```

Later, you will use `FROM` with multiple tables (joins) and even subqueries. But the concept is always the same: `FROM` defines your data source.

### WHERE: Filtering Rows

`WHERE` filters rows based on conditions. Only rows where the condition evaluates to `true` are included in the result.

```sql
SELECT name, price FROM products WHERE price > 100;
```

Common comparison operators:
- `=` equal to
- `!=` or `<>` not equal to
- `<`, `>`, `<=`, `>=` comparisons
- `AND`, `OR` combine conditions
- `NOT` negates a condition

### Logical Execution Order

SQL does **not** execute in the order you write it. The logical execution order is:

1. `FROM` — identify the table
2. `WHERE` — filter rows
3. `SELECT` — choose columns

This means `WHERE` runs before `SELECT`. You cannot use a column alias defined in `SELECT` inside a `WHERE` clause — the alias does not exist yet when `WHERE` executes.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `customers` — id, first_name, last_name, email, city, country, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at

## Step-by-Step Reasoning

1. **Start with FROM** — decide which table has the data you need.
2. **Add WHERE** — decide which rows to include. Think about what condition distinguishes the rows you want from those you do not.
3. **Choose SELECT** — decide which columns to return. Name only the columns that answer your question.

## Starter SQL

```sql
-- Products over $100
SELECT name, price
FROM products
WHERE price > 100
ORDER BY price DESC;
```

## Solution

```sql
-- Find expensive products (price > 100)
SELECT name, price, stock_quantity
FROM products
WHERE price > 100
ORDER BY price DESC;

-- Customers from a specific country
SELECT first_name, last_name, city
FROM customers
WHERE country = 'USA';

-- Recent orders with a minimum total
SELECT id, order_date, total_amount, status
FROM orders
WHERE total_amount > 500
  AND status = 'delivered'
ORDER BY order_date DESC;

-- Combining conditions with AND/OR
SELECT name, price, stock_quantity
FROM products
WHERE (price > 50 AND stock_quantity > 0)
   OR price > 500;
```

The first query demonstrates basic filtering with a comparison operator and ordering.

The second query filters on an exact string match. Note the single quotes around `'USA'` — SQL uses single quotes for string literals.

The third query combines two conditions with `AND` — both must be true for a row to be included. The results are ordered by date, newest first.

The fourth query shows operator precedence: `AND` binds tighter than `OR`. Without the parentheses, the logic would be different. Always use parentheses to make your intent explicit.

## Alternative Solutions

You can use column aliases to make results more readable:

```sql
SELECT
    name AS product_name,
    price AS unit_price,
    price * stock_quantity AS inventory_value
FROM products
WHERE stock_quantity > 0
ORDER BY inventory_value DESC;
```

The `AS` keyword creates an alias. Notice that `inventory_value` is a computed column — it does not exist in the table. SQL computes it for each row in the result. You can use aliases in `ORDER BY` (because it executes after `SELECT`) but NOT in `WHERE` (because it executes before `SELECT`).
