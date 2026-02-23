---
id: inner-join
phase: 4
phase_title: Joins & Relationships
sequence: 1
title: INNER JOIN
---

## Description

### Why Joins Exist

Relational databases split data across multiple tables to eliminate redundancy. A product's name lives in `products`, its category name lives in `categories`, and the link between them is a foreign key (`products.category_id` → `categories.id`).

To see a product alongside its category name, you must **join** the tables back together. This is the fundamental operation that makes relational databases powerful.

### What INNER JOIN Does

An `INNER JOIN` combines rows from two tables where the **join condition** is true. Rows that do not match are excluded entirely.

```sql
SELECT p.name, p.price, c.name AS category
FROM products p
INNER JOIN categories c ON c.id = p.category_id;
```

This query:
1. Takes each row from `products`
2. Looks for a matching row in `categories` where `categories.id = products.category_id`
3. If a match is found, combines the columns from both tables into one result row
4. If no match is found, the product row is **excluded** from the result

### The ON Clause

The `ON` clause specifies the join condition — how rows from the two tables relate to each other. It almost always matches a foreign key to a primary key:

```sql
-- orders.customer_id is the FK, customers.id is the PK
SELECT o.id, o.order_date, c.first_name, c.last_name
FROM orders o
INNER JOIN customers c ON c.id = o.customer_id;
```

You can join on any condition, but foreign key → primary key is the standard pattern.

### Table Aliases

When joining tables, you must qualify column names that exist in both tables. **Aliases** make this concise:

```sql
-- Without aliases (verbose)
SELECT products.name, categories.name
FROM products
INNER JOIN categories ON categories.id = products.category_id;

-- With aliases (clear and concise)
SELECT p.name, c.name AS category
FROM products p
INNER JOIN categories c ON c.id = p.category_id;
```

Best practice: always use aliases in joins, even when column names are unambiguous. It makes queries easier to read and refactor.

### Multi-Table Joins

You can chain multiple joins to connect several tables:

```sql
SELECT
    o.id AS order_id,
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount
FROM orders o
INNER JOIN customers c ON c.id = o.customer_id;
```

Each `JOIN` adds columns from another table to your result. The joins execute left to right — the result of the first join becomes the input to the second.

### Joining Through a Bridge Table

Many-to-many relationships use a **junction table** (bridge table). To connect the two sides, you join through the bridge:

```sql
-- Products and their tags (many-to-many via product_tags)
SELECT p.name AS product, t.name AS tag
FROM products p
INNER JOIN product_tags pt ON pt.product_id = p.id
INNER JOIN tags t ON t.id = pt.tag_id
ORDER BY p.name, t.name;
```

This two-hop join is the standard pattern for many-to-many relationships:
`products` → `product_tags` → `tags`

### INNER JOIN is the Default

The keyword `INNER` is optional. These two are identical:

```sql
SELECT * FROM orders INNER JOIN customers ON customers.id = orders.customer_id;
SELECT * FROM orders JOIN customers ON customers.id = orders.customer_id;
```

Most teams write just `JOIN` for inner joins and explicitly write `LEFT JOIN`, `RIGHT JOIN`, etc. for outer joins.

### What Gets Excluded

This is the critical mental model for `INNER JOIN`: **both sides must match**. If a product has no matching category (e.g., `category_id` is NULL or references a non-existent ID), that product disappears from the result.

This is safe when foreign keys are properly enforced (every `category_id` in `products` exists in `categories`). But in messy data, inner joins silently drop rows — which is why understanding join types matters.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `tags` — id, name
- `product_tags` — product_id, tag_id (junction table)

## Step-by-Step Reasoning

1. **Identify the data you need** — which columns, from which tables?
2. **Find the relationship** — which foreign key connects the tables?
3. **Write the FROM clause** — start with the primary table.
4. **Add JOIN clauses** — one per related table, with the `ON` condition matching FK to PK.
5. **Select columns** — use table aliases to qualify each column.
6. **Filter and sort** — `WHERE`, `ORDER BY`, etc. work exactly as before.

## Starter SQL

```sql
-- Products with their category names
SELECT
    p.name AS product,
    p.price,
    c.name AS category
FROM products p
INNER JOIN categories c ON c.id = p.category_id
ORDER BY c.name, p.name;
```

## Solution

```sql
-- Orders with customer names
SELECT
    o.id AS order_id,
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.status,
    o.total_amount
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.order_date DESC;

-- Order details: which products were in each order?
SELECT
    o.id AS order_id,
    o.order_date,
    p.name AS product,
    oi.quantity,
    oi.unit_price,
    oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
ORDER BY o.id, p.name;

-- Products with their tags (many-to-many)
SELECT
    p.name AS product,
    p.price,
    t.name AS tag
FROM products p
JOIN product_tags pt ON pt.product_id = p.id
JOIN tags t ON t.id = pt.tag_id
ORDER BY p.name, t.name;

-- Full order breakdown: customer + order + items + product names
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.order_date,
    p.name AS product,
    oi.quantity,
    oi.unit_price
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'delivered'
ORDER BY c.last_name, o.order_date, p.name;
```

The first query joins orders with customers. Every order has a `customer_id`, so no rows are lost with an inner join.

The second query chains three tables: orders → order_items → products. This is the standard "order detail" query that shows every line item with its product name.

The third query traverses the many-to-many relationship between products and tags through the `product_tags` bridge table. Each product-tag combination produces one row.

The fourth query joins four tables in a single query. The `WHERE` clause filters after all joins are resolved. This shows the full picture: who ordered what, when, and at what price — but only for delivered orders.

## Alternative Solutions

You can combine joins with aggregation to answer summary questions:

```sql
-- How many products per category? (join + GROUP BY)
SELECT
    c.name AS category,
    COUNT(*) AS product_count,
    ROUND(AVG(p.price), 2) AS avg_price
FROM products p
JOIN categories c ON c.id = p.category_id
GROUP BY c.name
ORDER BY product_count DESC;
```

You can also use the older comma-join syntax, but it is not recommended:

```sql
-- Old syntax (avoid in new code)
SELECT p.name, c.name
FROM products p, categories c
WHERE c.id = p.category_id;

-- Modern syntax (preferred — join logic is explicit)
SELECT p.name, c.name
FROM products p
JOIN categories c ON c.id = p.category_id;
```

The comma syntax mixes join conditions with filter conditions in `WHERE`, making complex queries harder to read. Always use explicit `JOIN ... ON` syntax.
