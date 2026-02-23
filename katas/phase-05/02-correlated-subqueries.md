---
id: correlated-subqueries
phase: 5
phase_title: Subqueries & CTEs
sequence: 2
title: Correlated Subqueries
---

## Description

### Subqueries That Reference the Outer Query

A **correlated subquery** is a subquery that references a column from the outer query. Unlike a simple subquery (which executes once), a correlated subquery is conceptually re-evaluated for **each row** of the outer query.

```sql
-- For each product, find the count of other products in the same category
SELECT
    p.name,
    p.category_id,
    (SELECT COUNT(*)
     FROM products p2
     WHERE p2.category_id = p.category_id AND p2.id != p.id
    ) AS siblings_in_category
FROM products p
ORDER BY siblings_in_category DESC;
```

The key: `p2.category_id = p.category_id` references `p` from the outer query. For each product row, the subquery counts how many *other* products share the same category.

### How Correlated Subqueries Execute

Conceptually (not necessarily physically):

1. Take a row from the outer query
2. Execute the inner query using values from that outer row
3. Return the result for that row
4. Repeat for the next outer row

This is why they can be slower than joins or window functions for large datasets — the inner query may execute many times. However, the optimizer often transforms correlated subqueries into joins internally.

### Visualizing Correlated Execution

Let's trace how a correlated subquery processes row by row:

```
Query: SELECT p.name, p.category_id,
       (SELECT COUNT(*) FROM products p2
        WHERE p2.category_id = p.category_id AND p2.id != p.id) AS siblings
       FROM products p;

Outer row 1: Bluetooth Headphones (category_id = 1)
  ┌─ Inner query: COUNT(*) FROM products WHERE category_id = 1 AND id != 1
  └─ Result: 4  (other Electronics products)

Outer row 2: USB-C Cable 3-Pack (category_id = 1)
  ┌─ Inner query: COUNT(*) FROM products WHERE category_id = 1 AND id != 2
  └─ Result: 4  (same category, different product excluded)

Outer row 3: Cotton T-Shirt (category_id = 2)
  ┌─ Inner query: COUNT(*) FROM products WHERE category_id = 2 AND id != 6
  └─ Result: 4  (other Clothing products)

... and so on for every row in products.

Final result:
┌──────────────────────────┬─────────────┬──────────┐
│ name                     │ category_id │ siblings │
├──────────────────────────┼─────────────┼──────────┤
│ Bluetooth Headphones     │           1 │        4 │
│ USB-C Cable 3-Pack       │           1 │        4 │
│ Cotton T-Shirt           │           2 │        4 │
│ SQL Performance Explained│           3 │        4 │
│ ...                      │         ... │      ... │
└──────────────────────────┴─────────────┴──────────┘
```

Notice: the inner query changes with each outer row because `p.category_id` changes.

### Visualizing EXISTS

```
Query: SELECT c.first_name FROM customers c
       WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

Customer: Alice (id = 1)
  ┌─ Inner: SELECT 1 FROM orders WHERE customer_id = 1
  │  Found order #1 → EXISTS = TRUE → ✓ include Alice
  └─ (stops searching — short-circuit)

Customer: Bob (id = 2)
  ┌─ Inner: SELECT 1 FROM orders WHERE customer_id = 2
  │  Found order #3 → EXISTS = TRUE → ✓ include Bob
  └─ (stops searching)

Customer: (hypothetical customer with no orders, id = 99)
  ┌─ Inner: SELECT 1 FROM orders WHERE customer_id = 99
  │  No rows found → EXISTS = FALSE → ✗ exclude
  └─ (scanned all matching rows, found none)
```

`EXISTS` short-circuits: it stops as soon as it finds the first match. This makes it efficient when matches are common.

### Visualizing NOT EXISTS

```
Query: SELECT c.first_name FROM customers c
       WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

Customer: Alice (id = 1)
  ┌─ Inner: found orders → NOT EXISTS = FALSE → ✗ exclude
  └─

Customer: (customer with no orders)
  ┌─ Inner: no orders found → NOT EXISTS = TRUE → ✓ include
  └─
```

`NOT EXISTS` is the inverse: it keeps rows where the inner query returns **zero** rows.

### Correlated Subqueries in WHERE

The most powerful pattern: filter rows based on related data in another table.

```sql
-- Customers who have placed at least one order over $200
SELECT c.first_name, c.last_name, c.email
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id AND o.total_amount > 200
);
```

`EXISTS` returns true if the subquery produces **any** rows. It does not care about the actual values — just whether a match exists. This is why `SELECT 1` is conventional (though `SELECT *` works identically).

### EXISTS vs IN

Both can filter based on related data, but they work differently:

```sql
-- Using EXISTS (correlated — references outer query)
SELECT c.first_name, c.last_name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id AND o.status = 'delivered'
);

-- Using IN (non-correlated — inner query runs independently)
SELECT c.first_name, c.last_name
FROM customers c
WHERE c.id IN (
    SELECT customer_id FROM orders WHERE status = 'delivered'
);
```

Both return the same result. Key differences:
- `EXISTS` stops at the first match (short-circuits) — efficient when matches are common
- `IN` builds a complete list first, then checks membership
- `EXISTS` handles NULLs naturally; `NOT IN` has NULL pitfalls (covered in Phase 6)
- For large datasets, `EXISTS` is often faster

### NOT EXISTS: The Safe Anti-Pattern

`NOT EXISTS` finds rows in the outer query that have **no matching** rows in the subquery:

```sql
-- Customers who have never placed an order
SELECT c.first_name, c.last_name, c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

This is functionally equivalent to a `LEFT JOIN ... WHERE IS NULL` anti-join, but many developers find `NOT EXISTS` more readable because the intent is explicit: "where no matching order exists."

### Correlated Subqueries in SELECT

You can compute per-row values from related tables:

```sql
-- Each customer's most recent order date
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    (SELECT MAX(o.order_date)
     FROM orders o
     WHERE o.customer_id = c.id
    ) AS last_order_date
FROM customers c
ORDER BY last_order_date DESC NULLS LAST;
```

For each customer, the subquery finds their latest order. Customers with no orders get NULL.

### Performance Consideration

Correlated subqueries can be expensive because they conceptually execute once per outer row. For large tables, consider these alternatives:
- **JOIN + GROUP BY** — for aggregating related data
- **Window functions** — for per-row computations within partitions (Phase 7)
- **Lateral joins** — PostgreSQL's efficient alternative to correlated subqueries

However, PostgreSQL's optimizer often transforms correlated subqueries into joins automatically, so the actual performance may be fine. Measure before optimizing.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Does the subquery need data from the outer row?** — If yes, it is correlated.
2. **Use EXISTS/NOT EXISTS** — when you need to check whether related rows exist.
3. **Use correlated scalar subquery in SELECT** — when you need a computed value per row from another table.
4. **Alias the outer table** — so the inner query can reference it unambiguously.
5. **Test the inner query** — substitute a specific outer value (e.g., `WHERE customer_id = 1`) to verify it works.

## Starter SQL

```sql
-- Customers who have placed at least one order
SELECT c.first_name, c.last_name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

## Solution

```sql
-- Customers with no orders (NOT EXISTS anti-join)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
)
ORDER BY c.last_name;

-- Each customer's order count and latest order (correlated in SELECT)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
    (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.id) AS last_order
FROM customers c
ORDER BY order_count DESC;

-- Products that have been ordered at least once
SELECT p.name, p.price
FROM products p
WHERE EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
)
ORDER BY p.name;

-- Products never ordered
SELECT p.name, p.price, p.stock_quantity
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
)
ORDER BY p.name;

-- Each product's price compared to its category average
SELECT
    p.name,
    p.price,
    p.category_id,
    (SELECT ROUND(AVG(p2.price), 2)
     FROM products p2
     WHERE p2.category_id = p.category_id
    ) AS category_avg,
    ROUND(p.price - (
        SELECT AVG(p2.price)
        FROM products p2
        WHERE p2.category_id = p.category_id
    ), 2) AS diff_from_category_avg
FROM products p
ORDER BY diff_from_category_avg DESC;
```

The first query finds customers with zero orders using `NOT EXISTS`. This is cleaner than a `LEFT JOIN` anti-join when the intent is simply "find rows without matches."

The second query uses two correlated scalar subqueries in `SELECT` to compute per-customer statistics. Each subquery runs conceptually once per customer row.

The third and fourth queries use `EXISTS` / `NOT EXISTS` to partition products into "ordered" and "never ordered" sets. Run both and confirm the lists are complementary.

The fifth query compares each product's price to its category average using a correlated subquery. The inner query filters by `p.category_id`, which changes for each outer row.

## Alternative Solutions

Correlated subqueries in `SELECT` can often be replaced with `LEFT JOIN` + aggregation:

```sql
-- JOIN approach: customer order stats
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(o.id) AS order_count,
    MAX(o.order_date) AS last_order
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY order_count DESC;
```

This is a single pass over the data instead of per-row subqueries. Both approaches return the same result.

PostgreSQL also supports `LATERAL` joins as an explicit alternative to correlated subqueries:

```sql
-- LATERAL join: per-customer order stats
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    stats.order_count,
    stats.last_order
FROM customers c
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS order_count, MAX(order_date) AS last_order
    FROM orders o
    WHERE o.customer_id = c.id
) stats ON true
ORDER BY stats.order_count DESC;
```

`LATERAL` allows the subquery to reference the outer table (like a correlated subquery) but in the `FROM` clause. The optimizer handles this efficiently.
