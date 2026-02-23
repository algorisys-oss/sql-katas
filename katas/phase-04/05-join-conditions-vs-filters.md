---
id: join-conditions-vs-filters
phase: 4
phase_title: Joins & Relationships
sequence: 5
title: Join Conditions vs Filters
---

## Description

### ON vs WHERE: A Subtle but Critical Difference

When you write a join, you have two places to put conditions:
- The `ON` clause (part of the join)
- The `WHERE` clause (after the join)

For `INNER JOIN`, the placement does not matter — the results are the same. But for **outer joins** (`LEFT`, `RIGHT`, `FULL`), the placement changes the result dramatically.

### INNER JOIN: ON and WHERE Are Equivalent

```sql
-- Condition in ON
SELECT p.name, c.name AS category
FROM products p
JOIN categories c ON c.id = p.category_id AND c.name = 'Electronics';

-- Condition in WHERE
SELECT p.name, c.name AS category
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.name = 'Electronics';
```

Both queries return the same rows. With `INNER JOIN`, filtering in `ON` or `WHERE` is interchangeable because unmatched rows are discarded either way.

### LEFT JOIN: ON and WHERE Are Different

This is where the distinction matters:

```sql
-- Condition in ON: keep ALL customers, only match delivered orders
SELECT
    c.first_name,
    o.id AS order_id,
    o.status
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered';
```

```sql
-- Condition in WHERE: keep only customers who HAVE delivered orders
SELECT
    c.first_name,
    o.id AS order_id,
    o.status
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'delivered';
```

**Query 1** (condition in `ON`): Returns **all customers**. For customers without delivered orders, the order columns are NULL. The `LEFT JOIN` preserves all left rows, and the extra condition in `ON` only affects which right rows match.

**Query 2** (condition in `WHERE`): Returns **only customers who have delivered orders**. The `LEFT JOIN` first produces all customers (with NULLs for non-matching orders), but then `WHERE o.status = 'delivered'` filters out NULL rows — effectively converting the `LEFT JOIN` into an `INNER JOIN`.

### The Rule

> **ON** defines which rows from the right table can match.
> **WHERE** filters the combined result after the join.

For outer joins:
- Put **join relationship conditions** in `ON` (e.g., `ON c.id = p.category_id`)
- Put **additional match criteria** in `ON` if you want to preserve unmatched left rows
- Put **filter conditions** in `WHERE` if you want to exclude rows entirely (including unmatched ones)

### Visual Example

Consider customers and their orders with a status filter:

**LEFT JOIN with condition in ON:**
```
Customer A → Order 1 (delivered) ✓ matched
Customer A → Order 2 (pending)   ✗ not matched (doesn't meet ON condition)
Customer B → (no orders at all)  → NULL row preserved
Result: Customer A + Order 1, Customer B + NULL
```

**LEFT JOIN with condition in WHERE:**
```
Customer A → Order 1 (delivered) ✓ kept by WHERE
Customer A → Order 2 (pending)   ✗ removed by WHERE
Customer B → NULL row            ✗ removed by WHERE (NULL != 'delivered')
Result: Customer A + Order 1 only
```

### Common Mistake: Accidentally Converting LEFT JOIN to INNER JOIN

This is one of the most common SQL bugs:

```sql
-- INTENDED: Show all customers, with their shipped orders if any
-- ACTUAL: Only shows customers with shipped orders (LEFT JOIN is neutralized)
SELECT c.first_name, o.id, o.shipped_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.shipped_at IS NOT NULL;
```

The `WHERE o.shipped_at IS NOT NULL` removes all rows where `o.shipped_at` is NULL — including the NULL rows created by the `LEFT JOIN` for unmatched customers.

Fix: move the condition to `ON`:

```sql
-- CORRECT: All customers, with shipped orders where they exist
SELECT c.first_name, o.id, o.shipped_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.shipped_at IS NOT NULL;
```

### Multiple Conditions in ON

You can put multiple conditions in the `ON` clause:

```sql
SELECT
    c.first_name,
    o.id AS order_id,
    o.total_amount
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id
    AND o.status = 'delivered'
    AND o.total_amount > 100;
```

This shows all customers, but only matches orders that are delivered **and** over $100. Customers without such orders still appear with NULL order columns.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **What type of join?** — `INNER` or `LEFT`?
2. **What defines the relationship?** — Always goes in `ON` (e.g., FK = PK).
3. **Additional conditions on the right table:**
   - Want to **preserve unmatched left rows**? → Put in `ON`
   - Want to **exclude unmatched left rows**? → Put in `WHERE`
4. **Test your assumption** — if using `LEFT JOIN` with a `WHERE` condition on the right table, check whether unmatched left rows survive.

## Starter SQL

```sql
-- All customers with their delivered orders (if any)
-- Non-delivered orders are excluded, but customers without
-- delivered orders still appear
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.status,
    o.total_amount
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id
    AND o.status = 'delivered'
ORDER BY c.last_name, o.order_date NULLS LAST;
```

## Solution

```sql
-- Compare: condition in ON vs WHERE for LEFT JOIN
-- Query A: Condition in ON — all customers preserved
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.status
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id
    AND o.status = 'delivered'
ORDER BY c.last_name;

-- Query B: Condition in WHERE — only customers with delivered orders
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    o.id AS order_id,
    o.status
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'delivered'
ORDER BY c.last_name;

-- Practical example: products with their "bestseller" tag (if any)
SELECT
    p.name AS product,
    p.price,
    t.name AS tag
FROM products p
LEFT JOIN product_tags pt
    ON pt.product_id = p.id
LEFT JOIN tags t
    ON t.id = pt.tag_id
    AND t.name = 'bestseller'
ORDER BY t.name NULLS LAST, p.name;

-- Customer summary with high-value delivered orders only
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(o.id) AS high_value_delivered,
    COALESCE(ROUND(SUM(o.total_amount), 2), 0) AS high_value_total
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id
    AND o.status = 'delivered'
    AND o.total_amount > 100
GROUP BY c.id, c.first_name, c.last_name
ORDER BY high_value_total DESC;
```

Run Query A and Query B and compare the row counts. Query A returns **all 20 customers** (some with NULL order columns). Query B returns **fewer rows** because the `WHERE` eliminates customers without delivered orders.

The third query shows all products but only attaches the "bestseller" tag. The condition `t.name = 'bestseller'` is in `ON`, so products without that tag still appear (with NULL tag). If you moved it to `WHERE`, non-bestseller products would disappear.

The fourth query counts only high-value delivered orders per customer, but preserves all customers in the result. Customers with no qualifying orders show `0` and `0.00`.

## Alternative Solutions

When the ON-vs-WHERE distinction gets confusing, you can use a subquery to pre-filter the right table before joining:

```sql
-- Pre-filter orders, then LEFT JOIN
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    do.id AS order_id,
    do.total_amount
FROM customers c
LEFT JOIN (
    SELECT * FROM orders WHERE status = 'delivered' AND total_amount > 100
) do ON do.customer_id = c.id
ORDER BY c.last_name;
```

This makes the intent explicit: first filter orders down to delivered high-value ones, then left-join the filtered set to customers. All customers are preserved because the `LEFT JOIN` sees only pre-filtered orders on the right side.

Some developers prefer this style because the filtering logic is isolated and clear, especially in complex queries with many conditions.
