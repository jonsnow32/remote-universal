/**
 * Minimal database interface used by repository classes.
 *
 * Designed to be implemented by `expo-sqlite` in the app layer, keeping
 * `@remote/core` free from native module dependencies.
 *
 * Usage in an Expo app:
 * ```ts
 * import * as SQLite from 'expo-sqlite';
 * import { CatalogRepository } from '@remote/core';
 *
 * const db = await SQLite.openDatabaseAsync('catalog.db');
 * const repo = new CatalogRepository(db);
 * ```
 */

export interface DatabaseRow {
  [column: string]: string | number | null;
}

export interface Database {
  /** Execute one or more SQL statements (DDL, INSERT, UPDATE, DELETE). */
  execAsync(sql: string): Promise<void>;

  /**
   * Execute a SELECT and return all matching rows.
   * @param sql   - Parameterised SQL, e.g. `SELECT * FROM foo WHERE id = ?`
   * @param params - Bind parameters in order
   */
  getAllAsync<T extends DatabaseRow>(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<T[]>;

  /**
   * Execute a SELECT and return the first matching row, or null.
   * @param sql   - Parameterised SQL
   * @param params - Bind parameters in order
   */
  getFirstAsync<T extends DatabaseRow>(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<T | null>;

  /**
   * Execute an INSERT / UPDATE / DELETE with bind parameters.
   * Returns the number of rows changed.
   */
  runAsync(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<{ changes: number; lastInsertRowId: number }>;
}
