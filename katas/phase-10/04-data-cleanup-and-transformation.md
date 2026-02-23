---
id: data-cleanup-and-transformation
phase: 10
phase_title: Real-World SQL Challenges
sequence: 4
title: Data Cleanup & Transformation
---

## Description

### Real Data Is Messy

Production databases accumulate inconsistencies over time: NULLs where values should exist, duplicate records, inconsistent formatting, orphaned references, and invalid data. SQL is a powerful tool for *finding* and *understanding* these problems.

### Common Data Quality Issues

```
Issue                  Example                         Detection
─────────────────     ──────────────────────────────   ────────────────────
Missing values        city IS NULL for 30% of rows     COUNT(*) FILTER (WHERE col IS NULL)
Duplicates            Same email, different IDs         GROUP BY ... HAVING COUNT(*) > 1
Inconsistent case     'USA', 'usa', 'Usa'             SELECT DISTINCT country
Trailing spaces       'Smith '                          WHERE name != TRIM(name)
Orphaned records      Order references deleted customer LEFT JOIN ... WHERE parent IS NULL
Invalid dates         Order shipped before it was placed WHERE shipped_at < order_date
Outliers              $999,999 order amount             Statistical deviation
```

### Finding NULLs

```sql
-- NULL audit: count NULLs per column
SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE city IS NULL) AS null_cities,
    COUNT(*) FILTER (WHERE total_amount IS NULL) AS null_amounts,
    COUNT(*) FILTER (WHERE shipped_at IS NULL) AS null_shipped
FROM orders o
JOIN customers c ON c.id = o.customer_id;
```

### Finding Duplicates

```sql
-- Exact duplicates
SELECT email, COUNT(*) AS count
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;

-- Near-duplicates (case-insensitive)
SELECT LOWER(email) AS normalized_email, COUNT(*) AS count
FROM customers
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;
```

### Data Validation Queries

```sql
-- Orders with invalid dates
SELECT * FROM orders
WHERE shipped_at IS NOT NULL AND shipped_at < order_date;

-- Orders with negative or zero amounts
SELECT * FROM orders
WHERE total_amount IS NOT NULL AND total_amount <= 0;

-- Orphaned order_items (product deleted but items remain)
SELECT oi.*
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE p.id IS NULL;
```

### Data Transformation Patterns

```
Pattern                     SQL Technique
──────────────────────     ─────────────────────────────────
Normalize case              UPPER(country), LOWER(email)
Remove whitespace           TRIM(name), BTRIM(name)
Fill NULLs                  COALESCE(city, 'Unknown')
Split strings               SPLIT_PART(email, '@', 2)
Parse dates                 TO_DATE(text, 'YYYY-MM-DD')
Categorize values           CASE WHEN ... THEN ... END
Remove duplicates           DISTINCT ON, ROW_NUMBER()
```

## Schema Overview

- `orders` — id, customer_id, order_date, status, total_amount (nullable), shipped_at (nullable)
- `order_items` — id, order_id, product_id, quantity, unit_price
- `products` — id, name, category_id, price, stock_quantity, created_at
- `categories` — id, name, description
- `customers` — id, first_name, last_name, email, city (nullable), country, created_at

## Step-by-Step Reasoning

1. **Audit first** → Understand the scope of data quality issues.
2. **Quantify** → How many rows are affected? What percentage?
3. **Categorize** → NULLs, duplicates, format issues, logical errors.
4. **Transform with SELECT** → Preview the cleaned result before modifying.
5. **Validate** → Confirm the transformation is correct on sample data.

## Starter SQL

```sql
-- Quick data quality audit for customers table
SELECT
    COUNT(*) AS total_customers,
    COUNT(*) FILTER (WHERE city IS NULL) AS missing_city,
    COUNT(*) FILTER (WHERE city IS NOT NULL) AS has_city,
    ROUND(COUNT(*) FILTER (WHERE city IS NULL)::numeric / COUNT(*) * 100, 1) AS pct_missing_city
FROM customers;
```

## Solution

```sql
-- Comprehensive NULL audit across tables
SELECT 'customers' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE city IS NULL) AS null_city,
    ROUND(COUNT(*) FILTER (WHERE city IS NULL)::numeric / COUNT(*) * 100, 1) AS pct_null_city
FROM customers
UNION ALL
SELECT 'orders',
    COUNT(*),
    COUNT(*) FILTER (WHERE total_amount IS NULL),
    ROUND(COUNT(*) FILTER (WHERE total_amount IS NULL)::numeric / COUNT(*) * 100, 1)
FROM orders
UNION ALL
SELECT 'orders (shipped_at)',
    COUNT(*),
    COUNT(*) FILTER (WHERE shipped_at IS NULL),
    ROUND(COUNT(*) FILTER (WHERE shipped_at IS NULL)::numeric / COUNT(*) * 100, 1)
FROM orders;

-- Find inconsistent country values
SELECT
    country,
    COUNT(*) AS customer_count,
    UPPER(TRIM(country)) AS normalized
FROM customers
GROUP BY country
ORDER BY normalized, country;

-- Data validation: logical inconsistencies
SELECT
    'Shipped before ordered' AS issue,
    COUNT(*) AS count
FROM orders
WHERE shipped_at IS NOT NULL AND shipped_at::date < order_date
UNION ALL
SELECT
    'Negative/zero amount',
    COUNT(*)
FROM orders
WHERE total_amount IS NOT NULL AND total_amount <= 0
UNION ALL
SELECT
    'Delivered but not shipped',
    COUNT(*)
FROM orders
WHERE status = 'delivered' AND shipped_at IS NULL
UNION ALL
SELECT
    'Shipped but still pending',
    COUNT(*)
FROM orders
WHERE shipped_at IS NOT NULL AND status = 'pending';

-- Orphan check: orders for non-existent customers
SELECT o.*
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE c.id IS NULL;

-- Orphan check: order_items for non-existent orders or products
SELECT
    'Missing order' AS issue,
    COUNT(*) AS orphaned_items
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL
UNION ALL
SELECT
    'Missing product',
    COUNT(*)
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE p.id IS NULL;

-- Transform: clean customer data (preview, no modification)
SELECT
    id,
    TRIM(first_name) AS first_name,
    TRIM(last_name) AS last_name,
    LOWER(TRIM(email)) AS email,
    COALESCE(TRIM(city), 'Unknown') AS city,
    UPPER(TRIM(country)) AS country,
    created_at
FROM customers
ORDER BY id;

-- Deduplicate: keep only the latest order per customer per date
-- (if a customer somehow has multiple orders on the same date)
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY customer_id, order_date
            ORDER BY id DESC  -- keep the latest by id
        ) AS rn
    FROM orders
)
SELECT id, customer_id, order_date, status, total_amount
FROM ranked
WHERE rn = 1
ORDER BY customer_id, order_date;

-- Email domain analysis
SELECT
    SPLIT_PART(email, '@', 2) AS domain,
    COUNT(*) AS customer_count
FROM customers
GROUP BY SPLIT_PART(email, '@', 2)
ORDER BY customer_count DESC;

-- Order amount outlier detection using standard deviation
WITH stats AS (
    SELECT
        AVG(total_amount) AS mean,
        STDDEV(total_amount) AS sd
    FROM orders
    WHERE total_amount IS NOT NULL
)
SELECT
    o.id,
    o.customer_id,
    o.total_amount,
    ROUND((o.total_amount - s.mean) / NULLIF(s.sd, 0), 2) AS z_score
FROM orders o, stats s
WHERE o.total_amount IS NOT NULL
AND ABS((o.total_amount - s.mean) / NULLIF(s.sd, 0)) > 2
ORDER BY ABS((o.total_amount - s.mean) / NULLIF(s.sd, 0)) DESC;
```

The first query audits NULL prevalence across key columns in different tables. This is the starting point for any data quality initiative.

The second query checks for inconsistent country formatting — a common issue when data comes from multiple sources or user input.

The third query validates logical consistency: orders shipped before they were placed, negative amounts, and status mismatches. These indicate application bugs or data migration issues.

The fourth and fifth queries check referential integrity — orphaned records that reference deleted parents. Even with foreign key constraints, these can occur after data migrations or bulk operations.

The sixth query previews a cleaned version of the customers table without modifying anything — always preview transformations before applying them.

The seventh query demonstrates deduplication using ROW_NUMBER — a pattern you'll use frequently with imported or merged data.

The eighth query extracts email domains to understand the customer base composition.

The ninth query uses z-scores to find statistical outliers in order amounts — values more than 2 standard deviations from the mean.

## Alternative Solutions

PostgreSQL's `DISTINCT ON` is a concise deduplication tool:

```sql
-- Deduplicate with DISTINCT ON (PostgreSQL-specific)
SELECT DISTINCT ON (customer_id, order_date)
    id, customer_id, order_date, status, total_amount
FROM orders
ORDER BY customer_id, order_date, id DESC;
```

This is shorter than the ROW_NUMBER approach and is equivalent for the top-1 case, but it only works in PostgreSQL and only selects one row per group.

For more sophisticated string cleaning, PostgreSQL offers regular expressions:

```sql
-- Remove non-alphanumeric characters from a string
SELECT REGEXP_REPLACE(email, '[^a-zA-Z0-9@._-]', '', 'g') AS cleaned_email
FROM customers;

-- Validate email format (basic pattern check)
SELECT email, email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AS valid_email
FROM customers;
```

Regular expressions are powerful but can be hard to maintain. For critical validation, prefer application-level checks.
