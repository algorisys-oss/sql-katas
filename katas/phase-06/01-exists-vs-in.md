---
id: exists-vs-in
phase: 6
phase_title: Advanced Filtering Patterns
sequence: 1
title: EXISTS vs IN
---

## Description

### Two Ways to Check for Related Data

Both `EXISTS` and `IN` let you filter rows based on data in another table. They often produce the same result, but they work differently — and understanding the difference matters for correctness and performance.

### IN: List Membership

`IN` checks whether a value appears in a list. The list can be hardcoded or produced by a subquery:

```sql
-- Hardcoded list
SELECT name, price FROM products WHERE category_id IN (1, 2, 3);

-- Subquery list
SELECT name, price
FROM products
WHERE category_id IN (
    SELECT id FROM categories WHERE name LIKE '%Electronics%'
);
```

The subquery runs independently (not correlated), produces a list of values, and then the outer query checks membership.

### EXISTS: Row Existence

`EXISTS` checks whether a correlated subquery returns **any rows**:

```sql
SELECT c.first_name, c.last_name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

For each outer row, the subquery runs and returns true/false. `EXISTS` short-circuits — it stops as soon as it finds the first match.

### Visualizing the Difference

```
IN approach:
┌─────────────────────────────────────┐
│ Step 1: Run inner query             │
│ SELECT customer_id FROM orders      │
│ WHERE status = 'delivered'          │
│ → Result: {1, 2, 3, 4, 5, 7, ...}  │  ← builds full list
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Step 2: Check each customer         │
│ WHERE c.id IN {1, 2, 3, 4, 5, ...} │  ← set membership
└─────────────────────────────────────┘

EXISTS approach:
┌─────────────────────────────────────┐
│ For customer Alice (id=1):          │
│   SELECT 1 FROM orders              │
│   WHERE customer_id = 1             │
│   AND status = 'delivered'          │
│   → Found row! → TRUE (stop)       │  ← short-circuits
├─────────────────────────────────────┤
│ For customer Bob (id=2):            │
│   SELECT 1 FROM orders              │
│   WHERE customer_id = 2             │
│   AND status = 'delivered'          │
│   → Found row! → TRUE (stop)       │
├─────────────────────────────────────┤
│ ...repeats for each customer...     │
└─────────────────────────────────────┘
```

### The NOT IN Trap with NULLs

This is the most important difference. `NOT IN` behaves unexpectedly when the subquery returns NULLs:

```sql
-- This might return ZERO rows even though unmatched customers exist!
SELECT first_name, last_name
FROM customers
WHERE id NOT IN (
    SELECT customer_id FROM orders  -- what if customer_id is NULL?
);
```

Why? If the `IN` list contains NULL, the comparison `id NOT IN (1, 2, NULL)` evaluates to `UNKNOWN` for every row — because `id != NULL` is always `UNKNOWN`. And `NOT UNKNOWN` is still `UNKNOWN`. So **no rows pass the filter**.

`NOT EXISTS` does not have this problem:

```sql
-- This always works correctly, regardless of NULLs
SELECT c.first_name, c.last_name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

### The Rule

> **Always prefer `NOT EXISTS` over `NOT IN`** when the subquery column might contain NULLs.

For positive checks (`IN` vs `EXISTS`), both are safe. But `NOT IN` with NULLs is a classic SQL bug.

### Performance Comparison

| Scenario | `IN` | `EXISTS` |
|----------|------|----------|
| Small subquery result | Fast (small list) | Fast (few checks) |
| Large subquery result | Slower (large list to build) | Faster (short-circuits) |
| Subquery with NULLs + NOT | **Broken** (returns no rows) | Correct |
| Indexed FK column | Both optimized similarly | Both optimized similarly |

In PostgreSQL, the optimizer often converts between `IN` and `EXISTS` internally, so performance differences are usually minimal. The correctness difference with `NOT IN` + NULLs is the real concern.

### When to Use Which

| Use Case | Recommendation |
|----------|---------------|
| Check against a small, known list | `IN (1, 2, 3)` |
| Check existence in related table | `EXISTS` (more explicit intent) |
| Negative check (find missing) | `NOT EXISTS` (NULL-safe) |
| Simple value list from subquery | Either works; `IN` reads naturally |

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at
- `tags` — id, name
- `product_tags` — product_id, tag_id

## Step-by-Step Reasoning

1. **Positive or negative check?** — "has" → `EXISTS` or `IN`. "doesn't have" → `NOT EXISTS`.
2. **Could the subquery return NULLs?** — If yes and negative check, use `NOT EXISTS`.
3. **Is the subquery correlated?** — Correlated → `EXISTS`. Independent list → `IN`.
4. **Readability** — `IN` reads naturally for value lists. `EXISTS` reads naturally for relationship checks.

## Starter SQL

```sql
-- Customers who have placed at least one order (using EXISTS)
SELECT c.first_name, c.last_name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
)
ORDER BY c.last_name;
```

## Solution

```sql
-- EXISTS: customers with delivered orders
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id AND o.status = 'delivered'
)
ORDER BY c.last_name;

-- IN: same result, different style
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE c.id IN (
    SELECT customer_id FROM orders WHERE status = 'delivered'
)
ORDER BY c.last_name;

-- NOT EXISTS: customers who have NEVER ordered (NULL-safe)
SELECT c.first_name || ' ' || c.last_name AS customer, c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
)
ORDER BY c.last_name;

-- Products not in any order (NOT EXISTS)
SELECT p.name, p.price
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
)
ORDER BY p.name;

-- Tags not assigned to any product (NOT EXISTS)
SELECT t.name AS unused_tag
FROM tags t
WHERE NOT EXISTS (
    SELECT 1 FROM product_tags pt WHERE pt.tag_id = t.id
)
ORDER BY t.name;

-- EXISTS with additional conditions: customers who ordered Electronics
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.customer_id = c.id AND p.category_id = 1
)
ORDER BY c.last_name;
```

The first two queries return the same result using `EXISTS` and `IN` respectively. Run both and compare — identical output, different approach.

The third, fourth, and fifth queries use `NOT EXISTS` to find "missing" relationships. This is the safe pattern for negative checks — no NULL surprises.

The sixth query demonstrates that `EXISTS` subqueries can contain joins and complex logic. The correlated subquery checks whether each customer has ordered any Electronics product.

## Alternative Solutions

If you must use `NOT IN`, always filter out NULLs explicitly:

```sql
-- Safe NOT IN (explicitly excludes NULLs)
SELECT c.first_name, c.last_name
FROM customers c
WHERE c.id NOT IN (
    SELECT customer_id FROM orders WHERE customer_id IS NOT NULL
);
```

Adding `WHERE customer_id IS NOT NULL` prevents the NULL trap. But `NOT EXISTS` is cleaner and does not require this workaround.

You can also use `LEFT JOIN ... WHERE IS NULL` as a third alternative for negative checks:

```sql
-- Anti-join: same result as NOT EXISTS
SELECT c.first_name || ' ' || c.last_name AS customer
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.last_name;
```

All three approaches (NOT EXISTS, safe NOT IN, LEFT JOIN anti-join) produce the same result. PostgreSQL typically generates similar execution plans for all of them.
