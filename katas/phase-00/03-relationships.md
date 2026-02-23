---
id: relationships
phase: 0
phase_title: Relational Thinking
sequence: 3
title: Relationships
---

## Description

### How Tables Connect

In a relational database, data is split across multiple tables — each table captures one entity. The power comes from **relationships** between these tables. Understanding relationship types is fundamental to writing correct queries.

### One-to-Many (1:N)

The most common relationship. One row in table A relates to many rows in table B.

**Examples in our schema:**
- One **category** has many **products** — Electronics contains Laptop, Phone, Tablet, etc.
- One **customer** has many **orders** — Alice may have placed 5 orders.
- One **order** has many **order_items** — a single order can contain 3 different products.

The "many" side holds the foreign key. `products.category_id` points to `categories.id`. The category does not list its products — instead, each product declares which category it belongs to.

### Many-to-Many (M:N)

Some relationships cannot be expressed with a single foreign key. A product can have many tags, and a tag can apply to many products. This is a **many-to-many** relationship.

The solution is a **junction table** (also called a bridge table or associative table). In our schema, `product_tags` is the junction table:

- `product_tags.product_id` → references `products.id`
- `product_tags.tag_id` → references `tags.id`

Each row in `product_tags` represents one link: "this product has this tag." A product with 3 tags has 3 rows in `product_tags`. A tag applied to 10 products has 10 rows.

> Junction tables are a fundamental pattern. Any time you see a table with two foreign keys and little else, you are looking at a many-to-many relationship.

### One-to-One (1:1)

Rare in practice. One row in table A relates to exactly one row in table B. This is usually used to split a large table into two for organizational reasons, or to separate sensitive data (like putting passwords in a separate table from user profiles).

Our schema does not have an explicit 1:1 relationship, but you can think of the relationship between a customer and their most recent order as a conceptual 1:1 — though it is actually a filtered 1:N.

### Reading Relationship Maps

To understand a database's relationships:
1. Find all foreign key columns (usually named `*_id`).
2. Trace what they reference.
3. Identify junction tables (tables with mostly foreign keys).
4. Draw the connections mentally: Category → Products → OrderItems ← Orders ← Customers.

## Schema Overview

- `categories` — id, name, description
- `products` — id, name, category_id (FK → categories), price, stock_quantity
- `tags` — id, name
- `product_tags` — id, product_id (FK → products), tag_id (FK → tags) *[junction table]*
- `customers` — id, first_name, last_name, email, city, country
- `orders` — id, customer_id (FK → customers), order_date, total_amount, status
- `order_items` — id, order_id (FK → orders), product_id (FK → products), quantity, unit_price

## Step-by-Step Reasoning

1. **Explore a 1:N relationship** — pick a category and find all its products. The category `id` appears as `category_id` in multiple product rows.

2. **Explore the junction table** — look at `product_tags` to see how products and tags are linked. Each row is a single product-tag pair.

3. **Count relationships** — how many products per category? How many tags per product? Aggregation queries reveal the shape of the data.

4. **Trace the full chain** — follow the path from a customer through their orders to the products they bought: customers → orders → order_items → products.

## Starter SQL

```sql
-- 1:N — Products in each category
SELECT c.name AS category, COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name
ORDER BY product_count DESC;
```

## Solution

```sql
-- M:N — Products and their tags via the junction table
SELECT p.name AS product, t.name AS tag
FROM products p
JOIN product_tags pt ON pt.product_id = p.id
JOIN tags t ON t.tag_id = pt.tag_id
ORDER BY p.name, t.name;

-- How many tags per product?
SELECT p.name, COUNT(pt.tag_id) AS tag_count
FROM products p
LEFT JOIN product_tags pt ON pt.product_id = p.id
GROUP BY p.name
ORDER BY tag_count DESC;

-- Full chain: customer → orders → items → products
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    p.name AS product,
    oi.quantity,
    oi.unit_price
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
ORDER BY c.last_name, o.id
LIMIT 20;
```

The first query demonstrates the many-to-many relationship: it joins `products` → `product_tags` → `tags` to show every product-tag pair. The junction table `product_tags` is the bridge.

The second query counts tags per product using `LEFT JOIN` (so products with zero tags still appear with a count of 0).

The third query traces the full relationship chain from customers through orders to the actual products purchased. This four-table join is a common real-world pattern — understanding the relationships makes it possible to write correctly.

## Alternative Solutions

You can explore relationships from the "other direction" — starting from a tag and finding all products:

```sql
-- Which products are tagged as 'bestseller'?
SELECT p.name, p.price
FROM tags t
JOIN product_tags pt ON pt.tag_id = t.id
JOIN products p ON p.id = pt.product_id
WHERE t.name = 'bestseller'
ORDER BY p.price DESC;
```

Notice how the junction table works identically in both directions. From products you can find tags, from tags you can find products. This symmetry is the defining characteristic of many-to-many relationships.

The tradeoff with junction tables: they add a join to every query that needs both sides of the relationship. This is a small cost for the flexibility they provide. The alternative — storing a comma-separated list of tag names in the products table — would make queries harder, violate first normal form, and break referential integrity.
