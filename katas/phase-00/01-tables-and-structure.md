---
id: tables-and-structure
phase: 0
phase_title: Relational Thinking
sequence: 1
title: Tables & Structure
---

## Description

### What is a Table?

A table is the fundamental unit of data storage in a relational database. Think of it as a structured collection of related facts. Each table represents a single **entity** or **concept** in your domain — customers, products, orders, categories.

A table has:

- **Columns** (also called fields or attributes) — define *what kind* of data is stored. Each column has a name and a data type.
- **Rows** (also called records or tuples) — represent individual instances. Each row is one customer, one product, one order.

### Data Types

Every column has a **data type** that constrains what values it can hold. PostgreSQL provides a rich type system:

| Type | Purpose | Example |
|------|---------|---------|
| `integer` | Whole numbers | `42`, `-7` |
| `numeric(p,s)` | Exact decimals | `29.99`, `1049.00` |
| `text` / `varchar(n)` | Strings | `'Alice'`, `'Electronics'` |
| `boolean` | True/false | `true`, `false` |
| `timestamp` | Date + time | `'2024-03-15 10:30:00'` |
| `serial` | Auto-incrementing integer | `1, 2, 3, ...` |

Choosing the right data type matters. It determines:
- What operations are valid (you cannot add two text values)
- How data is stored and indexed
- What constraints the database can enforce

### The E-Commerce Schema

Throughout these katas, we work with an e-commerce database. The schema includes:

- **categories** — product groupings (Electronics, Clothing, Books, etc.)
- **products** — items for sale, each belonging to a category
- **tags** — labels like "bestseller", "eco-friendly", "premium"
- **product_tags** — links products to tags (many-to-many)
- **customers** — people who place orders
- **orders** — purchases made by customers
- **order_items** — individual line items within an order

> This is a simplified model of a real e-commerce system. Real-world databases at companies like Amazon have thousands of tables — but the principles are identical.

### Exploring Structure with SQL

SQL provides commands to examine table structure. The most direct way to understand a table is to look at its data:

- `SELECT *` retrieves all columns
- `LIMIT` controls how many rows you see
- Column names in the result tell you the schema

## Schema Overview

- `customers` — id, first_name, last_name, email, city, country, created_at
- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at
- `order_items` — id, order_id, product_id, quantity, unit_price

## Step-by-Step Reasoning

To explore a table's structure:

1. **Start with `SELECT *`** — this shows you every column and a sample of the data. Always use `LIMIT` to avoid fetching thousands of rows.

2. **Read the column names** — the result header tells you the schema. Notice the naming conventions: `id`, `first_name`, `created_at`.

3. **Observe the data types** — integers, text, timestamps, and decimals each look different in the results. Notice how `price` has decimal places while `id` is a whole number.

4. **Look for NULLs** — some columns may contain NULL values. In our dataset, some customers have NULL for `city`, and some orders have NULL for `shipped_at`. These are intentional — real data is messy.

5. **Try different tables** — explore `products`, `categories`, `orders` to see how each table captures a different entity.

## Starter SQL

```sql
SELECT * FROM customers LIMIT 10;
```

## Solution

```sql
-- Explore the customers table
SELECT id, first_name, last_name, email, city, country
FROM customers
ORDER BY id
LIMIT 10;

-- Explore the products table with their prices
SELECT id, name, price, stock_quantity
FROM products
ORDER BY price DESC
LIMIT 10;

-- See what categories exist
SELECT * FROM categories;
```

The first query selects specific columns from `customers`, ordered by `id`. By naming columns explicitly instead of using `*`, you document exactly what data you need. This is a good habit — in production queries, `SELECT *` is discouraged because it fetches unnecessary data and breaks if the schema changes.

The second query explores products sorted by price (highest first). `DESC` reverses the default ascending order.

The third query uses `SELECT *` on `categories` without a `LIMIT` — this is fine because we know the categories table is small (about 10 rows). Use `SELECT *` freely when exploring small reference tables.

## Alternative Solutions

You can also examine table structure using PostgreSQL system commands:

```sql
-- List all tables in the public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- See column details for a specific table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

These queries use `information_schema` — a standard SQL feature (not PostgreSQL-specific) that lets you query the database's own structure. This is called **metadata** or **data about data**.

The tradeoff: `information_schema` queries give precise technical details (data types, nullability), while `SELECT * LIMIT` gives a quick visual understanding of what the data actually looks like. Both are valuable — use whichever fits your current need.
