---
id: comparison-operators
phase: 2
phase_title: Filtering & Conditions
sequence: 1
title: Comparison Operators & Boolean Logic
---

## Description

### The WHERE Clause Revisited

You saw `WHERE` in Phase 1 for simple filters. Now we go deeper: combining conditions, understanding precedence, and avoiding common logical mistakes.

### Comparison Operators

SQL supports the standard comparison operators:

| Operator | Meaning |
|---|---|
| `=` | Equal to |
| `!=` or `<>` | Not equal to |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |

These work on numbers, strings (alphabetical order), dates, and most other types.

### Combining Conditions: AND, OR, NOT

`AND` requires **both** conditions to be true:

```sql
WHERE price > 50 AND stock_quantity > 0
```

`OR` requires **at least one** condition to be true:

```sql
WHERE category_id = 1 OR category_id = 2
```

`NOT` negates a condition:

```sql
WHERE NOT status = 'cancelled'
```

### Operator Precedence: The Silent Bug

SQL evaluates `NOT` first, then `AND`, then `OR`. This means:

```sql
WHERE status = 'shipped' OR status = 'delivered' AND total_amount > 100
```

is actually interpreted as:

```sql
WHERE status = 'shipped' OR (status = 'delivered' AND total_amount > 100)
```

This returns **all** shipped orders (regardless of amount) plus delivered orders over $100. If you wanted high-value orders that are either shipped or delivered, you need parentheses:

```sql
WHERE (status = 'shipped' OR status = 'delivered') AND total_amount > 100
```

**Rule: always use parentheses when mixing AND and OR.** Do not rely on precedence — it is a source of subtle bugs.

### String Comparisons

String comparisons are **case-sensitive** in PostgreSQL by default:

```sql
WHERE country = 'USA'      -- matches 'USA', not 'usa' or 'Usa'
WHERE country = 'usa'      -- matches nothing if data stores 'USA'
```

For case-insensitive comparison, use `ILIKE` (covered in the next kata) or `LOWER()`:

```sql
WHERE LOWER(country) = 'usa'
```

### Date Comparisons

Dates compare chronologically:

```sql
WHERE order_date >= '2025-01-01'    -- orders from 2025 onwards
WHERE order_date < '2025-06-01'     -- orders before June 2025
```

Date strings in `'YYYY-MM-DD'` format are automatically cast to dates in PostgreSQL.

## Schema Overview

- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at
- `customers` — id, first_name, last_name, email, city, country, created_at

## Step-by-Step Reasoning

1. **Identify the filter criteria** — what conditions must rows satisfy?
2. **Choose operators** — equality, range, or negation?
3. **Combine with AND/OR** — do all conditions need to be true, or just some?
4. **Add parentheses** — make precedence explicit whenever you mix AND and OR.
5. **Test edge cases** — what about NULLs? What about boundary values (`>=` vs `>`)?

## Starter SQL

```sql
-- Products over $50 with stock available
SELECT name, price, stock_quantity
FROM products
WHERE price > 50 AND stock_quantity > 0
ORDER BY price DESC;
```

## Solution

```sql
-- Expensive products with stock
SELECT name, price, stock_quantity
FROM products
WHERE price > 50 AND stock_quantity > 0
ORDER BY price DESC;

-- Orders that are shipped or delivered
SELECT id, order_date, total_amount, status
FROM orders
WHERE status = 'shipped' OR status = 'delivered'
ORDER BY order_date DESC;

-- Precedence trap: parentheses matter!
-- High-value orders that are shipped or delivered
SELECT id, order_date, total_amount, status
FROM orders
WHERE (status = 'shipped' OR status = 'delivered')
  AND total_amount > 100
ORDER BY total_amount DESC;

-- NOT: orders that are not cancelled
SELECT id, order_date, total_amount, status
FROM orders
WHERE status != 'cancelled'
ORDER BY order_date DESC
LIMIT 15;

-- Range filter: products in a price range
SELECT name, price
FROM products
WHERE price >= 20 AND price <= 100
ORDER BY price;
```

The first query combines a price threshold with a stock check using `AND` — both must be true.

The second query uses `OR` to match either of two statuses. Every row where status is shipped OR delivered passes.

The third query shows why parentheses matter. Without them, `AND` binds tighter than `OR`, changing the meaning of the query entirely. Always parenthesize mixed boolean logic.

The fourth query uses `!=` to exclude cancelled orders. You could also write `NOT status = 'cancelled'` or `status <> 'cancelled'` — all three are equivalent.

The fifth query uses a range with `>=` and `<=`. The next kata introduces `BETWEEN` as a shorthand for this pattern.

## Alternative Solutions

You can use `<>` instead of `!=` for "not equal" — they are identical in SQL:

```sql
-- These are equivalent
SELECT * FROM orders WHERE status != 'cancelled';
SELECT * FROM orders WHERE status <> 'cancelled';
```

For multiple `OR` conditions on the same column, `IN` is cleaner (next kata):

```sql
-- Verbose
WHERE status = 'shipped' OR status = 'delivered' OR status = 'processing'

-- Cleaner (covered next)
WHERE status IN ('shipped', 'delivered', 'processing')
```

PostgreSQL also supports `BETWEEN` for range checks (next kata):

```sql
-- Equivalent to: WHERE price >= 20 AND price <= 100
WHERE price BETWEEN 20 AND 100
```
