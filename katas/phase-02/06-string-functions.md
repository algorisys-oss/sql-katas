---
id: string-functions
phase: 2
phase_title: Filtering & Conditions
sequence: 6
title: String Functions
---

## Description

### Working with Text Data

Real-world data is messy. Names have inconsistent casing, emails need domain extraction, addresses need parsing. SQL provides functions to transform, search, and manipulate text.

### Concatenation

Join strings together with `||`:

```sql
SELECT first_name || ' ' || last_name AS full_name FROM customers;
```

**NULL propagation:** If any part is NULL, the entire result is NULL. Use `COALESCE` to handle this:

```sql
SELECT COALESCE(city, '') || ', ' || country AS location FROM customers;
```

PostgreSQL also provides `CONCAT()` which treats NULLs as empty strings:

```sql
SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM customers;
```

### Case Functions

```sql
UPPER('hello')      -- 'HELLO'
LOWER('Hello')      -- 'hello'
INITCAP('hello world')  -- 'Hello World'
```

Useful for normalization:

```sql
WHERE LOWER(email) = 'alice@example.com'  -- case-insensitive match
```

### Length and Position

```sql
LENGTH('hello')          -- 5
CHAR_LENGTH('hello')     -- 5 (same as LENGTH)
POSITION('@' IN email)   -- index of @ in email (1-based), 0 if not found
STRPOS(email, '@')       -- same as POSITION (PostgreSQL)
```

### Substring Extraction

```sql
SUBSTRING(email FROM 1 FOR 5)    -- first 5 characters
SUBSTRING(email FROM POSITION('@' IN email) + 1)  -- everything after @
LEFT(name, 3)                     -- first 3 characters
RIGHT(email, 4)                   -- last 4 characters ('.com')
```

### Trimming and Padding

```sql
TRIM('  hello  ')            -- 'hello' (removes leading/trailing spaces)
LTRIM('  hello')             -- 'hello' (left trim only)
RTRIM('hello  ')             -- 'hello' (right trim only)
TRIM(BOTH '-' FROM '--hello--')  -- 'hello' (trim specific character)

LPAD('42', 5, '0')          -- '00042' (pad left to 5 chars with 0)
RPAD('hi', 5, '.')          -- 'hi...' (pad right to 5 chars with .)
```

### Search and Replace

```sql
REPLACE('hello world', 'world', 'SQL')   -- 'hello SQL'
TRANSLATE('hello', 'helo', 'HELO')       -- 'HELLO' (character-by-character)
```

### Splitting and Aggregating

```sql
SPLIT_PART('user@example.com', '@', 1)   -- 'user' (1st part split by @)
SPLIT_PART('user@example.com', '@', 2)   -- 'example.com' (2nd part)

STRING_AGG(name, ', ')                    -- aggregates: 'Alice, Bob, Charlie'
STRING_AGG(name, ', ' ORDER BY name)      -- sorted aggregation
```

## Schema Overview

- `customers` — id, first_name, last_name, email, city, country, created_at
- `products` — id, name, category_id, price, stock_quantity, created_at
- `orders` — id, customer_id, order_date, total_amount, status, shipped_at

## Step-by-Step Reasoning

1. **What transformation do you need?** — concatenation, case change, extraction, or cleanup?
2. **Handle NULLs** — use `COALESCE` or `CONCAT` to prevent NULL propagation.
3. **Choose the right function** — `SUBSTRING` for extraction, `REPLACE` for substitution, `TRIM` for cleanup.
4. **Combine functions** — chain them: `LOWER(TRIM(email))`.
5. **Consider performance** — functions in `WHERE` prevent index usage. Apply to the comparison value when possible.

## Starter SQL

```sql
-- Full name from first + last
SELECT
    first_name || ' ' || last_name AS full_name,
    email
FROM customers
ORDER BY last_name
LIMIT 10;
```

## Solution

```sql
-- Concatenation: full name and formatted location
SELECT
    first_name || ' ' || last_name AS full_name,
    COALESCE(city, '(unknown)') || ', ' || country AS location
FROM customers
ORDER BY last_name
LIMIT 15;

-- Email domain extraction
SELECT
    email,
    SPLIT_PART(email, '@', 1) AS username,
    SPLIT_PART(email, '@', 2) AS domain
FROM customers
ORDER BY domain, username
LIMIT 15;

-- Case normalization and length
SELECT
    name,
    UPPER(name) AS upper_name,
    LOWER(name) AS lower_name,
    INITCAP(name) AS title_case,
    LENGTH(name) AS name_length
FROM products
ORDER BY name_length DESC
LIMIT 10;

-- Substring and padding: formatted product codes
SELECT
    LPAD(id::text, 5, '0') AS product_code,
    LEFT(UPPER(name), 10) AS short_name,
    name,
    price
FROM products
ORDER BY id
LIMIT 15;

-- Search and replace in text
SELECT
    name,
    REPLACE(name, ' ', '-') AS slug,
    LOWER(REPLACE(name, ' ', '-')) AS url_slug
FROM products
ORDER BY name
LIMIT 10;

-- STRING_AGG: aggregate email domains
SELECT
    SPLIT_PART(email, '@', 2) AS domain,
    COUNT(*) AS customer_count,
    STRING_AGG(first_name, ', ' ORDER BY first_name) AS customers
FROM customers
GROUP BY SPLIT_PART(email, '@', 2)
ORDER BY customer_count DESC
LIMIT 10;
```

The first query builds full names and locations. `COALESCE` ensures NULL cities do not turn the entire location to NULL.

The second query splits emails at `@` to extract usernames and domains. `SPLIT_PART` is cleaner than `SUBSTRING` with `POSITION` for delimiter-based extraction.

The third query demonstrates case functions. `INITCAP` capitalizes the first letter of each word — useful for display normalization.

The fourth query creates formatted product codes: `LPAD` pads the ID to 5 digits (1 becomes 00001), and `LEFT` truncates long names.

The fifth query shows a practical pattern: creating URL slugs from product names by replacing spaces with hyphens and lowercasing.

The sixth query combines `SPLIT_PART` with `STRING_AGG` to group customers by email domain and list their names — a common reporting pattern.

## Alternative Solutions

PostgreSQL supports regular expression functions for complex text operations:

```sql
-- Extract email domain with regex
SELECT
    email,
    REGEXP_REPLACE(email, '.*@', '') AS domain
FROM customers
LIMIT 10;

-- Extract all numbers from a string
SELECT REGEXP_MATCHES('Order #123 with 5 items', '\d+', 'g');

-- Replace multiple spaces with single space
SELECT REGEXP_REPLACE('hello    world', '\s+', ' ', 'g') AS cleaned;
```

For case-insensitive searching, `ILIKE` is usually better than applying `LOWER()`:

```sql
-- LOWER() prevents index usage on the column
WHERE LOWER(name) = 'laptop'

-- ILIKE can use a trigram index if configured
WHERE name ILIKE 'laptop'
```

`CONCAT_WS` (concatenate with separator) simplifies multi-part concatenation:

```sql
-- CONCAT_WS skips NULLs automatically
SELECT CONCAT_WS(', ', city, country) AS location
FROM customers;
-- If city is NULL: just returns country (not ", country")
```
