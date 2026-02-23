---
id: keys-and-constraints
phase: 0
phase_title: Relational Thinking
sequence: 2
title: Keys & Constraints
---

## Description

### Why Keys Matter

Every row in a table needs to be uniquely identifiable. Without unique identification, you cannot reliably update, delete, or reference a specific row. This is where **keys** come in.

A **primary key** is a column (or combination of columns) that uniquely identifies each row in a table. Two rules are absolute:

1. Every value must be **unique** — no two rows can share the same primary key value.
2. The value can **never be NULL** — every row must have an identity.

In our e-commerce schema, every table has an `id` column as its primary key. This is a common pattern, but not the only one — email addresses, product SKUs, or composite keys (two columns together) can also serve as primary keys.

### Foreign Keys

A **foreign key** is a column that references the primary key of another table. It creates a **relationship** between the two tables.

In our schema:
- `products.category_id` references `categories.id` — every product belongs to a category
- `orders.customer_id` references `customers.id` — every order belongs to a customer
- `order_items.order_id` references `orders.id` — every line item belongs to an order
- `order_items.product_id` references `products.id` — every line item refers to a product

Foreign keys enforce **referential integrity** — you cannot create an order for a customer that does not exist, and you cannot delete a customer who has orders (unless you explicitly handle the cascade).

### Other Constraints

Beyond keys, databases enforce additional rules:

- **NOT NULL** — the column must always have a value. Our `customers.email` is NOT NULL; `customers.city` allows NULL.
- **UNIQUE** — all values in the column must be distinct. `customers.email` is UNIQUE — no two customers can share an email address.
- **CHECK** — a custom validation rule. For example, `products.price >= 0` ensures no negative prices.
- **DEFAULT** — provides a value when none is specified. `orders.status` defaults to `'pending'`.

### Observing Constraints in Practice

You cannot see constraints directly with a `SELECT` query — constraints are metadata about the table structure, not data in the table. But you can:

1. Query `information_schema` to see what constraints exist.
2. Try to violate a constraint and observe the error message.
3. Look at the data patterns — if all `id` values are unique and sequential, that suggests a primary key with auto-increment.

## Schema Overview

- `customers` — id (PK), email (UNIQUE, NOT NULL), first_name, last_name, city (nullable), country, created_at
- `products` — id (PK), name, category_id (FK → categories.id), price, stock_quantity, created_at
- `orders` — id (PK), customer_id (FK → customers.id), order_date, total_amount (nullable), status, shipped_at (nullable)
- `order_items` — id (PK), order_id (FK → orders.id), product_id (FK → products.id), quantity, unit_price

## Step-by-Step Reasoning

1. **Identify primary keys** — query each table and observe the `id` column. Notice it is always present, always unique, and never NULL.

2. **Trace foreign keys** — look at columns ending in `_id` (like `category_id`, `customer_id`). These are foreign keys pointing to another table's `id` column.

3. **Check constraints via information_schema** — PostgreSQL stores all constraint information in system catalogs. The `information_schema.table_constraints` view lists them.

4. **Test constraint enforcement** — try inserting or querying data that would violate constraints. The sandbox is read-only, but you can observe existing data patterns that result from these constraints.

## Starter SQL

```sql
-- See all constraints on the customers table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'customers'
ORDER BY constraint_type;
```

## Solution

```sql
-- List all constraints across all tables
SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
ORDER BY table_name, constraint_type;

-- See which columns are foreign keys and what they reference
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Verify primary key uniqueness: count vs distinct count should match
SELECT
    COUNT(id) AS total_rows,
    COUNT(DISTINCT id) AS distinct_ids
FROM customers;
```

The first query lists every constraint in the public schema — you will see PRIMARY KEY, FOREIGN KEY, UNIQUE, and CHECK constraints for each table.

The second query traces the foreign key relationships. It joins three `information_schema` views to show exactly which column in which table references which column in which other table. This is the relational map of your database.

The third query is a quick sanity check: if `COUNT(id)` equals `COUNT(DISTINCT id)`, the column is truly unique — as expected for a primary key.

## Alternative Solutions

You can also use PostgreSQL-specific catalog queries for more detail:

```sql
-- PostgreSQL-specific: detailed column info including defaults and nullability
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
```

The `column_default` column reveals default values (like `nextval('orders_id_seq')` for auto-incrementing primary keys). The `is_nullable` column shows which columns allow NULL.

Key insight: constraints are the **rules** that keep your data consistent. Without them, a database is just a collection of spreadsheets. With them, the database actively prevents bad data from entering the system. This is why relational databases are trusted for financial transactions, medical records, and e-commerce — the database itself enforces correctness.
