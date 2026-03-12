---
id: cursors
phase: 10
phase_title: Stored Procedures & Cursors
sequence: 2
title: Cursors
---

## Description

### What Is a Cursor?

A cursor is a **pointer to a result set** that lets you process rows **one at a time** instead of operating on the entire set at once.

```
Normal query execution (set-based):
  SELECT ... → entire result set returned at once
  [row1, row2, row3, ..., row10000] → all in memory

Cursor-based execution (row-by-row):
  DECLARE cursor → OPEN → FETCH row1 → process → FETCH row2 → process → ... → CLOSE
  Only one row (or a small batch) in memory at a time
```

### The Critical Truth About Cursors

> **Cursors fight against SQL's greatest strength: set-based processing.**

SQL engines are optimized to process entire result sets. When you use a cursor, you are:
- Forcing the engine into row-by-row mode
- Losing optimization opportunities (joins, parallel scans, batch I/O)
- Adding overhead for state management (open, fetch, close)

```
Operation              Set-Based                    Cursor-Based
─────────────────────  ──────────────────────────   ──────────────────────────
Update 10,000 rows     One UPDATE statement          10,000 FETCH + UPDATE cycles
  Time                 ~50ms                         ~5,000ms (100x slower)
Memory                 Optimized by engine           Row-by-row allocation
Lock behavior          One lock acquisition           10,000 lock acquisitions
```

### When Cursors ARE Appropriate

Despite the performance cost, cursors have legitimate uses:

```
Use Case                              Why a Cursor Fits
────────────────────────────────────  ─────────────────────────────────────────
Processing rows with side effects     Sending emails, calling APIs per row
Complex conditional branching         Different action per row based on state
Memory-constrained batch processing   Can't load millions of rows at once
Administrative/maintenance scripts    One-time cleanup, not production queries
Migrating data with row-level logic   Transform-and-insert with validation
Iterating when set-based is unclear   Prototype first, then optimize to sets
```

---

### PostgreSQL Cursors

PostgreSQL supports cursors both in **PL/pgSQL** (inside functions/procedures) and as **SQL-level commands** (in transactions).

#### PL/pgSQL Cursor — Explicit

```sql
CREATE OR REPLACE FUNCTION process_large_orders(p_threshold NUMERIC)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_order RECORD;
    v_count INT := 0;
    cur_orders CURSOR FOR
        SELECT id, customer_id, total_amount
        FROM orders
        WHERE total_amount > p_threshold
        ORDER BY total_amount DESC;
BEGIN
    OPEN cur_orders;

    LOOP
        FETCH cur_orders INTO v_order;
        EXIT WHEN NOT FOUND;

        -- Process each row (e.g., log, flag, transform)
        RAISE NOTICE 'Processing order %: $%', v_order.id, v_order.total_amount;
        v_count := v_count + 1;
    END LOOP;

    CLOSE cur_orders;
    RETURN v_count;
END;
$$;
```

#### PL/pgSQL Cursor — FOR Loop (Preferred)

PostgreSQL provides a simpler syntax that **automatically opens, fetches, and closes** the cursor:

```sql
CREATE OR REPLACE FUNCTION process_large_orders_v2(p_threshold NUMERIC)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_order RECORD;
    v_count INT := 0;
BEGIN
    FOR v_order IN
        SELECT id, customer_id, total_amount
        FROM orders
        WHERE total_amount > p_threshold
        ORDER BY total_amount DESC
    LOOP
        RAISE NOTICE 'Processing order %: $%', v_order.id, v_order.total_amount;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;
```

> **Best practice:** Use `FOR ... IN SELECT` loops instead of explicit `DECLARE/OPEN/FETCH/CLOSE`. Less boilerplate, no risk of forgetting to close the cursor.

#### Parameterized Cursors

```sql
CREATE OR REPLACE FUNCTION orders_by_status(p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    cur_orders CURSOR(c_status TEXT) FOR
        SELECT id, total_amount FROM orders WHERE status = c_status;
    v_order RECORD;
BEGIN
    FOR v_order IN cur_orders(p_status)
    LOOP
        RAISE NOTICE 'Order % — $%', v_order.id, v_order.total_amount;
    END LOOP;
END;
$$;
```

#### SQL-Level Cursors (Outside Functions)

You can also use cursors directly in SQL within a transaction:

```sql
BEGIN;

DECLARE order_cursor CURSOR FOR
    SELECT id, customer_id, total_amount
    FROM orders
    WHERE status = 'pending'
    ORDER BY order_date;

-- Fetch in batches
FETCH 10 FROM order_cursor;   -- first 10 rows
FETCH 10 FROM order_cursor;   -- next 10 rows
FETCH ALL FROM order_cursor;  -- remaining rows

CLOSE order_cursor;
COMMIT;
```

This is useful for **client-side batch processing** — the application fetches chunks instead of loading everything.

#### Scrollable Cursors

```sql
DECLARE order_cursor SCROLL CURSOR FOR
    SELECT id, total_amount FROM orders ORDER BY id;

FETCH FIRST FROM order_cursor;       -- first row
FETCH LAST FROM order_cursor;        -- last row
FETCH ABSOLUTE 5 FROM order_cursor;  -- 5th row
FETCH RELATIVE -2 FROM order_cursor; -- 2 rows back
```

> **Performance note:** Scrollable cursors require PostgreSQL to materialize the entire result set, negating the memory advantage. Use only when you genuinely need random access.

#### Refcursors — Returning Cursors from Functions

```sql
CREATE OR REPLACE FUNCTION get_order_cursor(p_status TEXT)
RETURNS REFCURSOR
LANGUAGE plpgsql
AS $$
DECLARE
    ref REFCURSOR := 'order_ref';
BEGIN
    OPEN ref FOR
        SELECT id, customer_id, total_amount
        FROM orders
        WHERE status = p_status;
    RETURN ref;
END;
$$;

-- Client usage (within a transaction):
BEGIN;
SELECT get_order_cursor('shipped');
FETCH 20 FROM order_ref;
CLOSE order_ref;
COMMIT;
```

This pattern lets the **client control fetching** while the server holds the result set.

---

### MySQL Cursors

MySQL supports cursors **only inside stored procedures/functions**. There are no SQL-level cursors.

#### Basic MySQL Cursor

```sql
DELIMITER //
CREATE PROCEDURE process_large_orders(IN p_threshold DECIMAL(10,2))
BEGIN
    DECLARE v_id INT;
    DECLARE v_amount DECIMAL(10,2);
    DECLARE v_done BOOLEAN DEFAULT FALSE;

    -- Declare cursor
    DECLARE cur_orders CURSOR FOR
        SELECT id, total_amount
        FROM orders
        WHERE total_amount > p_threshold;

    -- Handler for end of result set
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN cur_orders;

    read_loop: LOOP
        FETCH cur_orders INTO v_id, v_amount;
        IF v_done THEN
            LEAVE read_loop;
        END IF;

        -- Process each row
        SELECT CONCAT('Processing order ', v_id, ': $', v_amount) AS debug_msg;
    END LOOP;

    CLOSE cur_orders;
END //
DELIMITER ;
```

#### Key MySQL Cursor Limitations

```
Limitation                          Explanation
──────────────────────────────────  ─────────────────────────────────────────
Forward-only                        No SCROLL, no FETCH BACKWARD
Read-only                           Cannot UPDATE WHERE CURRENT OF
One row at a time                   No FETCH n (batch fetching)
Must declare before handlers        DECLARE order is enforced by MySQL parser
No SQL-level cursors                Only inside procedures/functions
No REFCURSOR                        Cannot return a cursor to the client
```

#### MySQL Cursor Patterns

```sql
-- MySQL requires a specific DECLARE order:
-- 1. Variables
-- 2. Cursors
-- 3. Handlers
-- Violating this order causes a syntax error.

DELIMITER //
CREATE PROCEDURE batch_update_prices(IN p_increase_pct DECIMAL(5,2))
BEGIN
    DECLARE v_id INT;
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_done BOOLEAN DEFAULT FALSE;

    DECLARE cur_products CURSOR FOR
        SELECT id, price FROM products WHERE price IS NOT NULL;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN cur_products;

    update_loop: LOOP
        FETCH cur_products INTO v_id, v_price;
        IF v_done THEN
            LEAVE update_loop;
        END IF;

        -- Only increase prices under $100
        IF v_price < 100 THEN
            UPDATE products SET price = v_price * (1 + p_increase_pct / 100) WHERE id = v_id;
        END IF;
    END LOOP;

    CLOSE cur_products;
END //
DELIMITER ;
```

---

### PostgreSQL vs MySQL Cursor Comparison

```
Feature                     PostgreSQL                    MySQL
──────────────────────────  ────────────────────────────  ────────────────────────
Where available             PL/pgSQL + SQL-level          Procedures/functions only
Scrollable                  Yes (SCROLL)                  No (forward-only)
Batch fetch                 FETCH n                       No (one row at a time)
Updatable                   UPDATE WHERE CURRENT OF       No
Refcursors                  Yes (return to client)        No
FOR loop shorthand          Yes (FOR ... IN SELECT)       No
Direction control           FORWARD, BACKWARD, ABSOLUTE   Forward only
```

---

### Best Practices

```
Practice                                  Why
────────────────────────────────────────  ─────────────────────────────────────────
Default to set-based SQL                  Cursors are a last resort, not a first choice
Use FOR loops over explicit cursors       Cleaner, auto-close, fewer bugs (PostgreSQL)
Always CLOSE cursors                      Avoid resource leaks (connections, memory)
Fetch in batches, not one-by-one          FETCH 100 is far better than 100x FETCH 1
Limit cursor result sets with WHERE       Don't open a cursor on a million-row table
Consider COPY or batch INSERT instead     For ETL, cursors are almost never the answer
Profile before and after                  Measure whether the cursor actually helps
```

#### Performance Tips

```
Tip                                       Explanation
────────────────────────────────────────  ─────────────────────────────────────────
Try rewriting as a single UPDATE/INSERT   Most cursor loops can be one SQL statement
  with CASE or CTE
Use server-side cursors for large reads   In PostgreSQL, DECLARE CURSOR in a tx
  lets clients page through results        without loading all rows into memory
Avoid cursors inside cursors              Nested cursors compound the performance
                                          hit — O(n*m) row processing
Use FETCH count (PostgreSQL)              FETCH 500 is ~100x faster than 500x FETCH 1
Don't use cursors for aggregation         SUM/COUNT/AVG are infinitely faster than
                                          cursor loops doing arithmetic
Avoid SCROLL unless needed                Scrollable cursors materialize the full
                                          result set — no memory savings
In MySQL, prefer temporary tables         Build a temp table with set operations,
  over cursor loops                       then process it — still faster
```

#### Refactoring Cursors Away

Most cursor code can be rewritten as set-based SQL. Here is a common example:

```
Cursor approach (slow):
  FOR each order:
      IF order.total > 1000 THEN UPDATE status = 'premium'
      ELSE UPDATE status = 'standard'

Set-based approach (fast):
  UPDATE orders SET status = CASE
      WHEN total_amount > 1000 THEN 'premium'
      ELSE 'standard'
  END;
```

> **Rule of thumb:** If you can describe what you want done to the data without saying "for each row", you don't need a cursor.

## Schema Overview

Uses the standard e-commerce dataset: `customers`, `orders`, `order_items`, `products`, `categories`.

## Step-by-Step Reasoning

1. Ask: **Can this be done with a single SQL statement?** If yes, don't use a cursor.
2. If row-by-row processing is genuinely needed, choose the simplest cursor form:
   - PostgreSQL: `FOR ... IN SELECT` loop (auto-managed)
   - MySQL: explicit `DECLARE`/`OPEN`/`FETCH`/`CLOSE`
3. Limit the cursor's result set — add WHERE clauses, don't scan entire tables
4. If processing large volumes, use batch fetching (PostgreSQL `FETCH n`)
5. Always close cursors and handle the NOT FOUND condition
6. After writing cursor code, ask again: can this be refactored to set-based SQL?

## Starter SQL

```sql
-- Write a PL/pgSQL function that uses a FOR loop cursor to find
-- customers whose total order value exceeds a threshold.
-- Return a TABLE of (customer_id, customer_name, total_spent).
-- Then consider: could this be done without a cursor?

```

## Solution

```sql
-- Cursor-based approach (for learning purposes)
CREATE OR REPLACE FUNCTION high_value_customers_cursor(p_threshold NUMERIC)
RETURNS TABLE(customer_id INT, customer_name TEXT, total_spent NUMERIC)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    FOR v_rec IN
        SELECT c.id, c.name, COALESCE(SUM(o.total_amount), 0) AS total
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id, c.name
        HAVING COALESCE(SUM(o.total_amount), 0) > p_threshold
        ORDER BY total DESC
    LOOP
        customer_id := v_rec.id;
        customer_name := v_rec.name;
        total_spent := v_rec.total;
        RETURN NEXT;
    END LOOP;
END;
$$;
```

Note that the cursor here adds no value — the query inside the FOR loop already computes the full answer. This is the point: most cursor usage is unnecessary.

## Alternative Solutions

### Set-Based (Preferred — No Cursor Needed)

```sql
CREATE OR REPLACE FUNCTION high_value_customers(p_threshold NUMERIC)
RETURNS TABLE(customer_id INT, customer_name TEXT, total_spent NUMERIC)
LANGUAGE sql
STABLE
AS $$
    SELECT c.id, c.name, COALESCE(SUM(o.total_amount), 0)
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(o.total_amount), 0) > p_threshold
    ORDER BY 3 DESC;
$$;
```

This `LANGUAGE sql` version is **inlineable** by PostgreSQL's planner and avoids all cursor overhead. It is faster, simpler, and easier to maintain.

### Plain Query (No Function Needed)

```sql
SELECT c.id, c.name, COALESCE(SUM(o.total_amount), 0) AS total_spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
HAVING COALESCE(SUM(o.total_amount), 0) > 5000
ORDER BY total_spent DESC;
```

The simplest solution is often no function at all. Use stored functions when the logic needs to be **reused across multiple callers** or when you need **parameterized access control**.
