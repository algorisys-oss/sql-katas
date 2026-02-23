---
id: normalization-and-denormalization
phase: 0
phase_title: Relational Thinking
sequence: 4
title: Normalization & Denormalization
---

## Description

### What is Normalization?

Normalization is the process of organizing data to **eliminate redundancy** and **ensure consistency**. It is a set of rules (called normal forms) that guide how you structure tables.

The core principle: **each fact should be stored exactly once.**

Consider a bad design where the `orders` table stores the customer's name, email, and city directly in every order row. If Alice places 10 orders, her name and email appear 10 times. If she changes her email, you must update all 10 rows — miss one, and your data is inconsistent. This is called an **update anomaly**.

### The Normal Forms

**First Normal Form (1NF):**
- Each column holds a single atomic value (no lists, no comma-separated values).
- Each row is unique (has a primary key).

*Violation example:* A `tags` column in products containing `"bestseller, eco-friendly, premium"`. Our schema avoids this by using a separate `product_tags` junction table.

**Second Normal Form (2NF):**
- Meets 1NF.
- Every non-key column depends on the **entire** primary key (not just part of it).

*Relevant when* using composite primary keys. If `order_items` had a composite key of `(order_id, product_id)`, then `unit_price` depends on the full composite key (good), but `customer_name` would depend only on `order_id` (bad — it should be in the `orders` table).

**Third Normal Form (3NF):**
- Meets 2NF.
- No non-key column depends on another non-key column (**no transitive dependencies**).

*Violation example:* Storing `category_name` in the `products` table alongside `category_id`. The category name depends on `category_id`, not on the product's primary key. Our schema correctly keeps category names in the `categories` table only.

### Why Our Schema is Normalized

Our e-commerce schema follows 3NF:
- Customer data lives in `customers` — not repeated in every order.
- Category names live in `categories` — not repeated in every product.
- Product data lives in `products` — not repeated in every order item.
- Tags are in a separate table with a junction table — not stored as comma-separated strings.

### When to Denormalize

Normalization optimizes for **data integrity** and **write efficiency**. But it requires **joins** for every query that spans multiple entities. In read-heavy systems (analytics dashboards, reporting), these joins can be expensive.

**Denormalization** intentionally introduces redundancy for read performance:
- Storing `total_amount` directly on `orders` instead of computing it from `order_items` each time.
- Creating summary tables that pre-aggregate data.
- Adding a `category_name` column to `products` to avoid joining `categories` for simple product listings.

> Our `orders.total_amount` is a practical denormalization. The "correct" normalized design would compute it from `SUM(order_items.quantity * order_items.unit_price)` every time. Storing it directly trades a small risk of inconsistency for significant query speed.

### The Tradeoff

| | Normalized | Denormalized |
|---|---|---|
| Data integrity | High — single source of truth | Risk of inconsistency |
| Storage | Efficient — no redundancy | More storage used |
| Writes | Fast — update one place | Slower — update multiple places |
| Reads | Requires joins | Fewer joins, faster queries |
| Best for | OLTP (transactions) | OLAP (analytics) |

## Schema Overview

- `orders` — total_amount is a denormalized field (could be computed from order_items)
- `order_items` — quantity, unit_price: the source of truth for line item costs
- `products` — category_id references categories (normalized: no category_name stored here)
- `product_tags` — junction table (normalized many-to-many, not comma-separated tags)

## Step-by-Step Reasoning

1. **Verify normalization** — confirm that customer data is not duplicated across orders by checking the orders table. You will see `customer_id` (a foreign key), not customer names repeated.

2. **Check the denormalized field** — compare `orders.total_amount` with the computed sum from `order_items` to see if they match. Any mismatch reveals the risk of denormalization.

3. **Measure the join cost** — compute the order total the "normalized" way (from order_items) and see the query complexity compared to simply reading `orders.total_amount`.

4. **Spot 1NF compliance** — verify that no column stores multiple values. Tags are in a junction table, not comma-separated.

## Starter SQL

```sql
-- Compare denormalized total_amount vs computed total
SELECT
    o.id AS order_id,
    o.total_amount AS stored_total,
    SUM(oi.quantity * oi.unit_price) AS computed_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.total_amount
ORDER BY o.id
LIMIT 15;
```

## Solution

```sql
-- Find orders where stored total differs from computed total (if any)
SELECT
    o.id AS order_id,
    o.total_amount AS stored_total,
    SUM(oi.quantity * oi.unit_price) AS computed_total,
    o.total_amount - SUM(oi.quantity * oi.unit_price) AS difference
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.total_amount
HAVING o.total_amount != SUM(oi.quantity * oi.unit_price)
   OR o.total_amount IS NULL
ORDER BY o.id;

-- Confirm normalization: orders store customer_id, not customer data
SELECT o.id, o.customer_id, o.order_date, o.total_amount
FROM orders o
LIMIT 10;

-- The normalized way to get customer + order info requires a join
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    c.email,
    o.id AS order_id,
    o.order_date,
    o.total_amount
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.order_date DESC
LIMIT 10;
```

The first query finds mismatches between the stored `total_amount` and the computed sum from `order_items`. If any rows appear, the denormalized data has drifted — this is exactly the risk of denormalization.

The second query shows that orders store a `customer_id` reference, not the customer's name or email. This is normalization in action — the customer's information exists in one place.

The third query demonstrates the cost of normalization: to see customer details alongside order data, you must join the two tables. This join is the price of keeping data consistent.

## Alternative Solutions

You can also verify 1NF compliance by checking that tags are properly normalized:

```sql
-- Tags are in a junction table, not comma-separated
-- Count how many tags each product has via the normalized structure
SELECT
    p.name AS product,
    COUNT(pt.tag_id) AS tag_count,
    STRING_AGG(t.name, ', ' ORDER BY t.name) AS tags
FROM products p
LEFT JOIN product_tags pt ON pt.product_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id
GROUP BY p.id, p.name
ORDER BY tag_count DESC
LIMIT 15;
```

`STRING_AGG` combines the normalized tag data back into a comma-separated display string. This is the reverse of denormalization — the data is stored correctly (one tag per row), but presented in a flattened format for human readability. The key difference: this flattening happens at query time, not at storage time. The source of truth remains normalized.
