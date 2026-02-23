---
id: limit-offset
phase: 1
phase_title: Basic SELECT
sequence: 4
title: LIMIT & OFFSET
---

## Description

### Controlling Result Size

Most real tables contain thousands or millions of rows. You rarely want all of them at once. `LIMIT` restricts how many rows the database returns.

```sql
SELECT name, price FROM products LIMIT 10;
```

This returns **at most** 10 rows. If the table has fewer than 10 rows, you get all of them.

### LIMIT Without ORDER BY is Unpredictable

A critical point: `LIMIT` without `ORDER BY` gives you an **arbitrary** subset. The database picks whichever rows it finds first — and this can change between queries. If you want the "top 10 most expensive products," you must sort first:

```sql
SELECT name, price FROM products ORDER BY price DESC LIMIT 10;
```

**Rule: always pair LIMIT with ORDER BY** unless you genuinely do not care which rows you get (e.g., when sampling data to explore a table).

### Pagination with OFFSET

`OFFSET` skips a number of rows before returning results:

```sql
SELECT name, price FROM products ORDER BY price DESC LIMIT 10 OFFSET 0;   -- page 1
SELECT name, price FROM products ORDER BY price DESC LIMIT 10 OFFSET 10;  -- page 2
SELECT name, price FROM products ORDER BY price DESC LIMIT 10 OFFSET 20;  -- page 3
```

The formula: `OFFSET = (page_number - 1) * page_size`.

### The OFFSET Performance Problem

OFFSET-based pagination has a hidden cost: the database must **read and discard** all the skipped rows. `OFFSET 10000` means the database processes 10,000 rows and throws them away before returning the next page.

For small offsets (pages 1–50), this is fine. For deep pagination (page 500 of results), performance degrades significantly. In production systems, **keyset pagination** (also called cursor-based pagination) is preferred — but that requires understanding `WHERE` clauses and indexes, which come later.

### FETCH FIRST (SQL Standard)

`LIMIT` is a PostgreSQL/MySQL extension. The SQL standard uses `FETCH FIRST`:

```sql
-- Standard SQL (also works in PostgreSQL)
SELECT name, price FROM products ORDER BY price DESC FETCH FIRST 10 ROWS ONLY;

-- With offset
SELECT name, price FROM products ORDER BY price DESC OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY;
```

Both forms work in PostgreSQL. `LIMIT`/`OFFSET` is more common in practice, but `FETCH FIRST` is the portable syntax.

### Common Patterns

```sql
-- Get one row (e.g., the most expensive product)
SELECT name, price FROM products ORDER BY price DESC LIMIT 1;

-- Sample data from a table (explore its structure)
SELECT * FROM orders LIMIT 5;

-- "Top N per category" requires more advanced techniques (window functions)
-- LIMIT alone cannot solve this — it limits the entire result, not per-group
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `customers` — id, first_name, last_name, email, city, country, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at

## Step-by-Step Reasoning

1. **Decide what you want** — the "top N" or "most recent N" of something? You need `ORDER BY` + `LIMIT`.
2. **Choose the sort column and direction** — most expensive = `ORDER BY price DESC`. Most recent = `ORDER BY order_date DESC`.
3. **Set the limit** — how many rows do you actually need?
4. **Add offset if paginating** — calculate `(page - 1) * page_size`.

## Starter SQL

```sql
-- Top 5 most expensive products
SELECT name, price
FROM products
ORDER BY price DESC
LIMIT 5;
```

## Solution

```sql
-- Top 10 most expensive products
SELECT name, price, stock_quantity
FROM products
ORDER BY price DESC
LIMIT 10;

-- Most recent 10 orders with customer info
SELECT o.id, o.order_date, o.total_amount, o.status
FROM orders o
ORDER BY o.order_date DESC
LIMIT 10;

-- Page 2 of products sorted by name (10 per page)
SELECT name, price
FROM products
ORDER BY name ASC
LIMIT 10 OFFSET 10;

-- The single cheapest product
SELECT name, price
FROM products
ORDER BY price ASC
LIMIT 1;

-- Compare: LIMIT without ORDER BY (unpredictable!)
SELECT name, price
FROM products
LIMIT 5;
```

The first query finds the 10 most expensive products. `ORDER BY price DESC` sorts highest-first, then `LIMIT 10` takes the top 10.

The second query gets the most recent orders — a pattern used in virtually every application that shows "recent activity."

The third query demonstrates pagination: `OFFSET 10` skips the first page (rows 1–10) and returns the second page (rows 11–20).

The fourth query uses `LIMIT 1` to find a single extreme value. This is equivalent to using `MAX(price)` in some cases, but `LIMIT 1` also gives you the rest of the row's data.

The last query shows `LIMIT` without `ORDER BY` — the rows you get are arbitrary. Run it multiple times and you may get different results.

## Alternative Solutions

PostgreSQL supports the SQL standard `FETCH FIRST` syntax:

```sql
-- Standard SQL equivalent of LIMIT 10
SELECT name, price
FROM products
ORDER BY price DESC
FETCH FIRST 10 ROWS ONLY;

-- Standard SQL equivalent of LIMIT 10 OFFSET 10
SELECT name, price
FROM products
ORDER BY name ASC
OFFSET 10 ROWS
FETCH NEXT 10 ROWS ONLY;
```

Both `LIMIT` and `FETCH FIRST` produce identical results in PostgreSQL. `LIMIT` is shorter and more widely used. `FETCH FIRST` is the SQL standard and works across more databases.

For production applications with large datasets, OFFSET-based pagination becomes slow at high page numbers. The preferred alternative is **keyset pagination**:

```sql
-- Instead of OFFSET 1000, use a WHERE clause on the last seen value
SELECT name, price
FROM products
WHERE price < 29.99  -- last price from previous page
ORDER BY price DESC
LIMIT 10;
```

Keyset pagination is always fast regardless of page depth, but it requires a unique, sortable column and cannot jump to arbitrary page numbers. This technique is covered in later phases.
