---
id: indexes
phase: 9
phase_title: Query Execution & Performance Awareness
sequence: 3
title: Indexes
---

## Description

### What Is an Index?

An index is a separate data structure that helps the database find rows quickly — like a book's index helps you find topics without reading every page.

```
Without index (Seq Scan):
  Read EVERY row → check condition → return matches
  Table: [row1] [row2] [row3] [row4] [row5] ... [row1000000]
         ↑ check ↑ check ↑ check ... slow for large tables

With index (Index Scan):
  Look up value in index → jump directly to matching rows
  Index: { 'delivered' → [row3, row7, row42, ...] }
         ↑ fast lookup → read only matching rows
```

### B-Tree: The Default Index

PostgreSQL uses **B-tree** indexes by default. They work like a sorted tree:

```
B-tree index on orders(status):

                    [delivered | pending | shipped]
                   /           |                  \
        [cancelled, delivered] [pending]    [shipped]
        /        \              |            |      \
    [row1,row5] [row3,row7]  [row2,row8]  [row4,row6] [row9,row10]

Query: WHERE status = 'delivered'
  → Tree traversal: root → left → find all 'delivered' rows
  → Direct access to rows 3, 7, ... (no full table scan)
```

### Creating and Dropping Indexes

```sql
-- Create a single-column index
CREATE INDEX idx_orders_status ON orders (status);

-- Create a composite (multi-column) index
CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date);

-- Create a unique index (also enforces uniqueness)
CREATE UNIQUE INDEX idx_customers_email ON customers (email);

-- Drop an index
DROP INDEX idx_orders_status;
```

### When Does PostgreSQL Use an Index?

The query planner decides. Key factors:

```
Factor                   Index Used?     Why?
────────────────────    ──────────────   ──────────────────────────────
Small table (<1000)      Usually NO      Seq Scan is faster for small tables
High selectivity         YES             Few matching rows → index efficient
  (WHERE id = 42)
Low selectivity          NO              Many matching rows → Seq Scan
  (WHERE status IN                       is faster than jumping around
   ('a','b','c','d'))
Column in WHERE          YES             Direct lookup
Column in JOIN ON        YES             Join acceleration
Column in ORDER BY       Sometimes       Can provide pre-sorted output
Function on column       NO!             WHERE UPPER(name) = 'X'
                                         defeats the index (see below)
```

### Composite Index Column Order Matters

```
Index: CREATE INDEX idx ON orders (customer_id, order_date);

This index supports:
  ✓ WHERE customer_id = 5                    (leftmost column)
  ✓ WHERE customer_id = 5 AND order_date > '2024-01-01'  (both columns)
  ✓ ORDER BY customer_id, order_date         (matches index order)

This index does NOT efficiently support:
  ✗ WHERE order_date > '2024-01-01'          (skips leftmost column)
  ✗ ORDER BY order_date, customer_id         (wrong column order)

Rule: composite indexes work LEFT to RIGHT.
Think of it like a phone book: sorted by last name, then first name.
You can look up "Smith" or "Smith, John", but not just "John".
```

### Covering Indexes and Index-Only Scans

```
A "covering index" includes all columns the query needs.
The database reads ONLY the index — never touches the table.

Query: SELECT customer_id, order_date FROM orders WHERE customer_id = 5;

Index: CREATE INDEX idx ON orders (customer_id, order_date);

Plan: Index Only Scan using idx
      → All needed columns (customer_id, order_date) are IN the index
      → Table access completely avoided = fastest possible scan
```

### The Cost of Indexes

```
Indexes are NOT free:

  + Faster reads (SELECT queries)
  - Slower writes (every INSERT/UPDATE/DELETE must update ALL indexes)
  - Storage space (indexes consume disk)
  - Maintenance overhead (VACUUM must maintain index entries)

Trade-off:
  Read-heavy workload → more indexes = good
  Write-heavy workload → fewer indexes = good
  OLTP (mixed) → index selectively
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `products` — id, name, category_id, price, stock_quantity, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price

## Step-by-Step Reasoning

1. **Identify slow queries** → Use EXPLAIN ANALYZE to find Seq Scans on large tables.
2. **Check the WHERE clause** → Which columns are filtered? Those are index candidates.
3. **Check JOIN conditions** → Foreign key columns benefit from indexes.
4. **Consider selectivity** → Index on `id` (unique) = great. Index on `status` (3 values) = depends on data distribution.
5. **Watch for function wrapping** → `WHERE UPPER(email) = ...` defeats a plain index on `email`.

## Starter SQL

```sql
-- Check what indexes exist on orders table
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders'
ORDER BY indexname;
```

## Solution

```sql
-- See existing indexes on all our tables
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Compare: Seq Scan without useful index
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'delivered';

-- Compare: query that uses the primary key index
EXPLAIN ANALYZE
SELECT * FROM orders WHERE id = 5;

-- Join query: check if foreign key has an index
EXPLAIN ANALYZE
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.order_date,
    o.total_amount
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.customer_id = 3;

-- Show how function on column prevents index use
-- (even if an index exists on the column)
EXPLAIN ANALYZE
SELECT * FROM customers WHERE LOWER(email) = 'alice@example.com';

-- vs. direct comparison (can use index if one exists)
EXPLAIN ANALYZE
SELECT * FROM customers WHERE email = 'alice@example.com';

-- Check table and index sizes
SELECT
    relname AS name,
    pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
    pg_size_pretty(pg_relation_size(oid)) AS table_size,
    pg_size_pretty(pg_indexes_size(oid)) AS index_size
FROM pg_class
WHERE relname IN ('orders', 'customers', 'products', 'order_items')
ORDER BY pg_total_relation_size(oid) DESC;
```

The first query lists all existing indexes, showing what PostgreSQL created automatically (primary keys get indexes) and any additional indexes.

The second and third queries contrast a scan on a non-indexed column (status) vs a primary key lookup (id). The primary key query should show an Index Scan.

The fourth query checks join performance on the foreign key `customer_id`.

The fifth and sixth queries demonstrate that wrapping a column in a function (`LOWER()`) prevents index use. This is one of the most common performance mistakes.

The last query shows how much space tables and indexes consume.

## Alternative Solutions

For columns frequently queried with functions, use **expression indexes**:

```sql
-- Create an index on the LOWER of email
CREATE INDEX idx_customers_email_lower ON customers (LOWER(email));

-- Now this query CAN use the index:
SELECT * FROM customers WHERE LOWER(email) = 'alice@example.com';
```

For partial data, use **partial indexes**:

```sql
-- Index only pending orders (useful if most orders are delivered)
CREATE INDEX idx_orders_pending ON orders (order_date)
WHERE status = 'pending';

-- This query uses the partial index:
SELECT * FROM orders WHERE status = 'pending' ORDER BY order_date;
```

Partial indexes are smaller and faster because they only contain rows matching the WHERE condition.
