---
id: logical-vs-physical-execution
phase: 9
phase_title: Query Execution & Performance Awareness
sequence: 1
title: Logical vs Physical Execution Order
---

## Description

### SQL Doesn't Run in the Order You Write It

When you write:

```sql
SELECT name, SUM(total_amount) AS total
FROM orders
JOIN customers ON customers.id = orders.customer_id
WHERE status = 'delivered'
GROUP BY name
HAVING total > 100
ORDER BY total DESC
LIMIT 10;
```

The database does **not** start with `SELECT`. It follows a **logical execution order**:

### The Logical Execution Order

```
Written Order:          Logical Execution Order:

 1. SELECT               1. FROM / JOIN        ← gather tables
 2. FROM                 2. WHERE              ← filter rows
 3. WHERE                3. GROUP BY           ← form groups
 4. GROUP BY             4. HAVING             ← filter groups
 5. HAVING               5. SELECT             ← evaluate expressions
 6. ORDER BY             6. DISTINCT           ← remove duplicates
 7. LIMIT                7. ORDER BY           ← sort results
                         8. LIMIT / OFFSET     ← paginate
```

### Why This Matters

```
Q: Why can't I use a column alias in WHERE?

SELECT total_amount * 1.1 AS with_tax
FROM orders
WHERE with_tax > 100;  ← ERROR! "with_tax" doesn't exist yet

Logical order: WHERE runs BEFORE SELECT
The alias "with_tax" is defined in SELECT (step 5)
but WHERE runs at step 2.

Fix 1: Repeat the expression
WHERE total_amount * 1.1 > 100

Fix 2: Use a CTE/subquery
WITH computed AS (
    SELECT *, total_amount * 1.1 AS with_tax FROM orders
)
SELECT * FROM computed WHERE with_tax > 100;
```

### Where Aliases Work

```
Clause       Can use SELECT aliases?   Why?
─────────    ───────────────────────   ─────────────────────
WHERE        NO                        Runs before SELECT
GROUP BY     NO (standard SQL)         Runs before SELECT
             YES (PostgreSQL extension) Postgres allows it
HAVING       NO (standard SQL)         Runs before SELECT
             YES (PostgreSQL extension) Postgres allows it
ORDER BY     YES                       Runs after SELECT
LIMIT        N/A                       Uses constants
```

### Physical Execution: The Optimizer

The logical order defines **correctness** — what the result should be. But the **query optimizer** may physically rearrange operations for performance:

```
Logical:   FROM orders → WHERE status = 'delivered' → GROUP BY ...
Physical:  Index scan on orders(status) → only reads matching rows → GROUP BY ...

The optimizer pushed the WHERE filter INTO the scan.
The result is the same, but the execution is more efficient.
```

The optimizer's goal: **same result, fewer operations**.

### Common Pitfalls from Misunderstanding Execution Order

```
Pitfall 1: Using aggregate in WHERE
  WHERE SUM(total_amount) > 100    ← ERROR
  HAVING SUM(total_amount) > 100   ← CORRECT (aggregates need GROUP BY first)

Pitfall 2: Referencing outer column in wrong scope
  SELECT * FROM customers
  WHERE id IN (SELECT customer_id FROM orders GROUP BY customer_id)
  -- Works because the subquery is fully evaluated first

Pitfall 3: DISTINCT + ORDER BY conflict
  SELECT DISTINCT city FROM customers ORDER BY created_at
  -- ERROR in strict SQL: ORDER BY column must be in SELECT list
  -- (because DISTINCT runs before ORDER BY, and created_at was removed)
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `products` — id, name, category_id, price, stock_quantity, created_at

## Step-by-Step Reasoning

1. **Memorize the logical order** → FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT.
2. **Alias errors?** → Check if the alias is used before SELECT in logical order.
3. **Aggregate errors?** → Aggregates require GROUP BY; filter them with HAVING, not WHERE.
4. **Performance thinking** → The optimizer may change physical order, but results stay the same.

## Starter SQL

```sql
-- This fails: alias used in WHERE (before SELECT in logical order)
-- Try running it, then fix it
SELECT
    first_name || ' ' || last_name AS full_name,
    city
FROM customers
WHERE full_name LIKE 'A%';
```

## Solution

```sql
-- Fix 1: Repeat the expression in WHERE
SELECT
    first_name || ' ' || last_name AS full_name,
    city
FROM customers
WHERE first_name || ' ' || last_name LIKE 'A%'
ORDER BY full_name;

-- Fix 2: Use a CTE to define the alias first
WITH named AS (
    SELECT
        id,
        first_name || ' ' || last_name AS full_name,
        city
    FROM customers
)
SELECT full_name, city
FROM named
WHERE full_name LIKE 'A%'
ORDER BY full_name;

-- Demonstrate: aliases work in ORDER BY (runs after SELECT)
SELECT
    first_name || ' ' || last_name AS full_name,
    COUNT(*) AS order_count
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY order_count DESC;

-- Demonstrate: HAVING filters groups (runs after GROUP BY)
SELECT
    c.country,
    COUNT(*) AS order_count,
    ROUND(AVG(o.total_amount), 2) AS avg_amount
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.total_amount IS NOT NULL
GROUP BY c.country
HAVING COUNT(*) >= 3
ORDER BY order_count DESC;
```

The first two queries show different approaches to working around the alias-in-WHERE limitation.

The third query demonstrates that ORDER BY *can* use aliases because it runs after SELECT.

The fourth query shows the proper use of WHERE (filters rows before grouping) vs HAVING (filters groups after aggregation). Note how WHERE filters NULL amounts *before* grouping, while HAVING filters on the aggregate result *after* grouping.

## Alternative Solutions

PostgreSQL extends standard SQL by allowing column aliases in GROUP BY and HAVING:

```sql
-- PostgreSQL-specific: alias in GROUP BY
SELECT
    DATE_TRUNC('month', order_date)::date AS month,
    COUNT(*) AS orders
FROM orders
GROUP BY month  -- alias! Standard SQL requires the full expression
ORDER BY month;
```

This is convenient but not portable to other databases. In standard SQL, you'd repeat `DATE_TRUNC('month', order_date)::date` in the GROUP BY clause.
