---
id: stored-procedures
phase: 10
phase_title: Stored Procedures & Cursors
sequence: 1
title: Stored Procedures & Functions
---

## Description

### What Are Stored Procedures and Functions?

Stored procedures and functions are **named blocks of SQL and procedural logic** stored inside the database itself. Instead of sending multiple queries from your application, you package logic into a callable unit that runs **server-side**.

```
Application code without stored procedures:
  App → SELECT ... → process → UPDATE ... → process → INSERT ...
  (multiple round-trips, logic scattered across application)

Application code with stored procedures:
  App → CALL process_order(42)
  (one round-trip, logic lives in the database)
```

### Why Use Them?

```
Benefit                         Explanation
──────────────────────────────  ─────────────────────────────────────────
Reduced network round-trips     Logic runs on the server, not client
Encapsulation                   Complex business logic in one place
Reusability                     Call the same logic from any client
Security                        Grant EXECUTE without exposing tables
Atomicity                       Wrap multiple statements in a transaction
```

### When NOT to Use Them

```
Antipattern                     Why It Hurts
──────────────────────────────  ─────────────────────────────────────────
All business logic in DB        Hard to test, version, and deploy
Procedures calling procedures   Debugging becomes a nightmare
Heavy string manipulation       SQL is not designed for this
Logic that changes frequently   Application code is easier to deploy
Vendor lock-in concerns         PL/pgSQL ≠ MySQL procedures ≠ T-SQL
```

Key insight:
> Stored procedures are powerful for **data-centric operations**. But they are not a replacement for application logic. Use them where the database is the right place for the work.

---

### PostgreSQL: Functions and Procedures

PostgreSQL has two constructs:

- **FUNCTION** — returns a value, can be used in SQL expressions, existed since early Postgres
- **PROCEDURE** — does not return a value, supports transaction control (`COMMIT`/`ROLLBACK` inside the body), added in PostgreSQL 11

#### Creating a Function (PL/pgSQL)

```sql
CREATE OR REPLACE FUNCTION get_customer_order_total(p_customer_id INT)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total
    FROM orders
    WHERE customer_id = p_customer_id;

    RETURN v_total;
END;
$$;
```

Calling it:

```sql
-- Use in a SELECT (functions can appear anywhere an expression can)
SELECT id, name, get_customer_order_total(id) AS lifetime_value
FROM customers
WHERE get_customer_order_total(id) > 1000;
```

#### Creating a Procedure (PL/pgSQL)

```sql
CREATE OR REPLACE PROCEDURE archive_old_orders(p_cutoff_date DATE)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO orders_archive
    SELECT * FROM orders WHERE order_date < p_cutoff_date;

    DELETE FROM orders WHERE order_date < p_cutoff_date;

    -- Procedures can control transactions
    COMMIT;
END;
$$;
```

Calling it:

```sql
CALL archive_old_orders('2024-01-01');
```

#### Function vs Procedure in PostgreSQL

```
Feature                FUNCTION                    PROCEDURE
─────────────────────  ─────────────────────────   ──────────────────────────
Returns value          Yes (RETURNS type)          No
Use in SELECT          Yes                         No
Transaction control    No (runs in caller's tx)    Yes (COMMIT/ROLLBACK)
Called with            SELECT func()               CALL proc()
```

#### Parameter Modes

```sql
CREATE FUNCTION example(
    IN  p_input   INT,      -- read-only (default)
    OUT p_output  TEXT,      -- returned to caller
    INOUT p_both  INT       -- read and returned
)
LANGUAGE plpgsql AS $$
BEGIN
    p_output := 'result';
    p_both := p_both + p_input;
END;
$$;
```

#### SECURITY DEFINER vs SECURITY INVOKER

```sql
-- Runs with the privileges of the function OWNER (like Unix setuid)
CREATE FUNCTION admin_lookup(p_id INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER  -- careful! this elevates privileges
AS $$ ... $$;

-- Runs with the privileges of the CALLER (default, safer)
CREATE FUNCTION safe_lookup(p_id INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$ ... $$;
```

> **Best practice:** Default to `SECURITY INVOKER`. Only use `SECURITY DEFINER` when you intentionally need privilege escalation, and always set `search_path` explicitly to prevent search-path attacks.

#### Returning Tables

```sql
CREATE OR REPLACE FUNCTION get_top_customers(p_limit INT)
RETURNS TABLE(customer_id INT, customer_name TEXT, total_spent NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name, COALESCE(SUM(o.total_amount), 0)
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id, c.name
    ORDER BY 3 DESC
    LIMIT p_limit;
END;
$$;

-- Use like a table
SELECT * FROM get_top_customers(10);
```

#### Error Handling

```sql
CREATE OR REPLACE FUNCTION safe_divide(a NUMERIC, b NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
    IF b = 0 THEN
        RAISE EXCEPTION 'Division by zero: cannot divide % by %', a, b
            USING ERRCODE = '22012';
    END IF;
    RETURN a / b;
EXCEPTION
    WHEN numeric_value_out_of_range THEN
        RAISE NOTICE 'Overflow detected';
        RETURN NULL;
END;
$$;
```

---

### MySQL: Stored Procedures and Functions

MySQL uses a different syntax but similar concepts.

#### Creating a Function (MySQL)

```sql
DELIMITER //
CREATE FUNCTION get_customer_order_total(p_customer_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(10,2);

    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total
    FROM orders
    WHERE customer_id = p_customer_id;

    RETURN v_total;
END //
DELIMITER ;
```

> MySQL requires `DELIMITER` changes because the default `;` conflicts with statement endings inside the body. PostgreSQL avoids this with `$$` dollar quoting.

#### Creating a Procedure (MySQL)

```sql
DELIMITER //
CREATE PROCEDURE archive_old_orders(IN p_cutoff_date DATE)
BEGIN
    INSERT INTO orders_archive
    SELECT * FROM orders WHERE order_date < p_cutoff_date;

    DELETE FROM orders WHERE order_date < p_cutoff_date;

    COMMIT;
END //
DELIMITER ;

-- Call it
CALL archive_old_orders('2024-01-01');
```

#### Key MySQL Differences

```
Feature                     PostgreSQL                  MySQL
──────────────────────────  ────────────────────────    ────────────────────────
Language                    PL/pgSQL (and others)       SQL/PSM (built-in only)
Body quoting                $$ dollar quoting $$        DELIMITER required
Multiple languages          Yes (PL/Python, PL/Perl)    No
RETURNS TABLE               Yes                         No (use OUT params or temp tables)
Transaction control         PROCEDURE only              Both (with limitations)
Function characteristics    VOLATILE/STABLE/IMMUTABLE   DETERMINISTIC/NOT DETERMINISTIC
```

---

### Best Practices

```
Practice                              Why
────────────────────────────────────  ─────────────────────────────────────────
Keep procedures focused               One procedure = one responsibility
Use explicit parameter modes           IN/OUT/INOUT make intent clear
Handle errors with EXCEPTION blocks    Don't let failures propagate silently
Log or RAISE NOTICE for debugging      Procedures are harder to debug than app code
Version control your DDL               Store CREATE FUNCTION in migration files
Avoid dynamic SQL unless necessary     SQL injection risk; harder to optimize
Use IMMUTABLE/STABLE where true        Helps the planner optimize function calls
Don't nest procedures deeply           Call stacks in SQL are painful to debug
```

#### Performance Tips

```
Tip                                   Explanation
────────────────────────────────────  ─────────────────────────────────────────
Mark functions IMMUTABLE/STABLE       PostgreSQL can cache or fold results
Avoid calling functions in WHERE      get_total(id) > 100 runs per-row
Use RETURNS TABLE over loops          Set-based returns are faster than
                                      row-by-row RETURN NEXT
Prefer SQL-language functions         CREATE FUNCTION ... LANGUAGE sql
  for simple logic                    can be inlined by the planner
Avoid excessive RAISE/PRINT           Logging in tight loops kills performance
Use prepared statements inside        Avoids repeated parse/plan overhead
  dynamic SQL (EXECUTE ... USING)     in PostgreSQL
```

> **PostgreSQL-specific:** A `LANGUAGE sql` function (not plpgsql) can be **inlined** by the query planner — the function body gets folded into the calling query. This is significantly faster for simple logic. Use `plpgsql` only when you need procedural control flow.

## Schema Overview

Uses the standard e-commerce dataset: `customers`, `orders`, `order_items`, `products`, `categories`.

## Step-by-Step Reasoning

1. Identify logic that is **data-centric** — operates on multiple tables, needs atomicity
2. Decide: function (returns value, usable in SQL) or procedure (side effects, transaction control)
3. Define clear parameters with explicit modes (IN/OUT/INOUT)
4. Write the body using set-based operations where possible
5. Add error handling for expected failure cases
6. Test with edge cases: NULLs, empty results, constraint violations

## Starter SQL

```sql
-- Create a function that returns the number of orders
-- for a given customer in a given year
-- Parameters: customer_id (INT), order_year (INT)
-- Returns: INTEGER

```

## Solution

```sql
CREATE OR REPLACE FUNCTION count_customer_orders_in_year(
    p_customer_id INT,
    p_order_year INT
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM orders
    WHERE customer_id = p_customer_id
      AND EXTRACT(YEAR FROM order_date) = p_order_year;

    RETURN v_count;
END;
$$;
```

This function is marked `STABLE` because it reads data but does not modify it, and will return the same result within a single statement for the same inputs.

## Alternative Solutions

### Pure SQL Function (Inlineable)

```sql
CREATE OR REPLACE FUNCTION count_customer_orders_in_year(
    p_customer_id INT,
    p_order_year INT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM orders
    WHERE customer_id = p_customer_id
      AND EXTRACT(YEAR FROM order_date) = p_order_year;
$$;
```

This `LANGUAGE sql` version can be **inlined** by PostgreSQL's planner — the function body is substituted directly into the calling query, avoiding function-call overhead entirely. Prefer this for simple, read-only logic.

### Application-Side Approach

For simple counts, a plain query may be better than a function:

```sql
SELECT COUNT(*)
FROM orders
WHERE customer_id = 42
  AND EXTRACT(YEAR FROM order_date) = 2025;
```

Not everything needs to be a stored procedure. Use them when they genuinely simplify your architecture — not as a default.
