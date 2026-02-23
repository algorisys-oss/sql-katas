---
id: anti-joins
phase: 6
phase_title: Advanced Filtering Patterns
sequence: 2
title: Anti-Joins
---

## Description

### Finding What's Missing

An **anti-join** returns rows from the left table that have **no matching rows** in the right table. It answers questions like:

- Which customers have never placed an order?
- Which products have never been sold?
- Which tags are unused?

This is one of the most common real-world SQL patterns — finding missing, orphaned, or unmatched data.

### Three Ways to Write an Anti-Join

SQL does not have an explicit `ANTI JOIN` keyword. Instead, you achieve it with one of three patterns:

```
Pattern 1: LEFT JOIN + WHERE IS NULL
┌──────────┐    LEFT JOIN    ┌──────────┐
│ customers │ ─────────────→ │  orders  │
└──────────┘                 └──────────┘
      │                            │
      │  WHERE orders.id IS NULL   │
      │  (keep unmatched left rows)│
      ▼
┌────────────────────┐
│ customers without  │
│ any orders         │
└────────────────────┘

Pattern 2: NOT EXISTS
┌──────────┐    For each customer:
│ customers │ → Does any order exist?
└──────────┘   NO → keep the customer
               YES → exclude

Pattern 3: NOT IN
┌──────────┐    Build list of customer_ids
│ customers │ → from orders, then exclude
└──────────┘   customers in that list
               ⚠ NULL danger!
```

### Pattern 1: LEFT JOIN + WHERE IS NULL

```sql
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
```

How it works:
1. `LEFT JOIN` preserves all customers
2. Customers with orders get matched rows; customers without get NULLs
3. `WHERE o.id IS NULL` keeps only the unmatched (NULL) rows

**Important:** test on the right table's **primary key** (or a NOT NULL column), not any nullable column. Using a nullable column could produce false positives.

### Pattern 2: NOT EXISTS

```sql
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

How it works:
1. For each customer, check if any order exists
2. If no order exists → `NOT EXISTS` is true → keep the customer
3. Short-circuits: stops searching as soon as one match is found

### Pattern 3: NOT IN (Use with Caution)

```sql
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE c.id NOT IN (
    SELECT customer_id FROM orders WHERE customer_id IS NOT NULL
);
```

**Always add `WHERE column IS NOT NULL`** to the subquery to avoid the NULL trap (see Phase 6, Kata 1).

### Comparison

| Pattern | NULL-safe? | Readability | Performance |
|---------|-----------|-------------|-------------|
| LEFT JOIN + IS NULL | Yes | Moderate | Good |
| NOT EXISTS | Yes | Best intent | Good |
| NOT IN | Only with IS NOT NULL | Concise | Good (if no NULLs) |

All three typically produce the same execution plan in PostgreSQL. Choose based on readability and NULL safety.

### Anti-Join with Additional Conditions

You can add conditions to find specific types of missing relationships:

```sql
-- Customers who have never placed a DELIVERED order
-- (they may have pending or cancelled orders)
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id AND o.status = 'delivered'
);
```

This is different from "customers with no orders" — these customers might have orders, just none that are delivered.

With `LEFT JOIN`:

```sql
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'
WHERE o.id IS NULL;
```

Note: the status filter goes in `ON`, not `WHERE`. If placed in `WHERE`, it would filter out the NULL rows from the LEFT JOIN (converting it to an inner join).

### Multi-Table Anti-Joins

You can chain anti-joins to find rows missing from multiple relationships:

```sql
-- Products that have NEITHER been ordered NOR tagged
SELECT p.name, p.price
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
)
AND NOT EXISTS (
    SELECT 1 FROM product_tags pt WHERE pt.product_id = p.id
);
```

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `tags` — id, name
- `product_tags` — product_id, tag_id

## Step-by-Step Reasoning

1. **What are you looking for?** — Rows from table A with no match in table B.
2. **Choose a pattern** — `NOT EXISTS` is the safest default.
3. **Are there additional conditions?** — Put them inside the `NOT EXISTS` subquery or in the `LEFT JOIN ON` clause (not `WHERE`).
4. **Need multiple anti-joins?** — Chain `AND NOT EXISTS (...)` clauses.

## Starter SQL

```sql
-- Customers who have never ordered (LEFT JOIN pattern)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    c.email,
    c.created_at AS joined
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.created_at;
```

## Solution

```sql
-- Three anti-join patterns side by side (same result)
-- Pattern 1: LEFT JOIN + IS NULL
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.last_name;

-- Pattern 2: NOT EXISTS
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
ORDER BY c.last_name;

-- Pattern 3: NOT IN (with NULL guard)
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE c.id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)
ORDER BY c.last_name;

-- Products never sold
SELECT p.name, p.price, p.stock_quantity
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
)
ORDER BY p.price DESC;

-- Categories with no products (empty categories)
SELECT c.name AS empty_category
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM products p WHERE p.category_id = c.id
)
ORDER BY c.name;

-- Customers who ordered but never had an order delivered
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
)
AND NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'delivered'
)
ORDER BY c.last_name;
```

The first three queries demonstrate all three anti-join patterns returning the same result. Run all three and compare.

The fourth query finds products with zero sales — useful for inventory cleanup or identifying products that need marketing.

The fifth query finds empty categories — categories defined in the system but with no products assigned.

The sixth query combines `EXISTS` and `NOT EXISTS`: find customers who have placed orders but none have been delivered. This dual-condition pattern is powerful for segmentation.

## Alternative Solutions

For counting-based anti-joins, you can use `HAVING COUNT(...) = 0`:

```sql
-- Customers with zero delivered orders (aggregation approach)
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(o.id) AS total_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'delivered') AS delivered
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
HAVING COUNT(o.id) FILTER (WHERE o.status = 'delivered') = 0
ORDER BY total_orders DESC;
```

This gives you more context (total orders alongside the zero delivered count) but is more verbose than a simple `NOT EXISTS`.

For large datasets where performance matters, all three anti-join patterns typically produce the same PostgreSQL execution plan (a Hash Anti Join or Merge Anti Join). The optimizer is smart enough to recognize the intent regardless of syntax.
