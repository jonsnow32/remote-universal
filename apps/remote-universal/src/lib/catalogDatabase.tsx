/**
 * Catalog Database Provider
 *
 * Unlike ir.db (~84 MB, lazy-loaded), the catalog cache is lightweight and
 * initialises eagerly at app start. It stores brands + models fetched from
 * Supabase so subsequent opens are instant / offline-capable.
 *
 * Usage (App.tsx):
 *   <CatalogDatabaseProvider>
 *     {children}
 *   </CatalogDatabaseProvider>
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { _initCatalogLocalDb } from './catalogLocalDb';

// ─── Internal bridge ──────────────────────────────────────────────────────────

function CatalogDbBridge({ onReady }: { onReady: () => void }): null {
  const db = useSQLiteContext();
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    _initCatalogLocalDb(db);
    onReady();
  }, [db, onReady]);
  return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CatalogDatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const handleReady = useCallback(() => {
    console.log('[CatalogDb] Local catalog cache ready');
  }, []);

  return (
    <SQLiteProvider
      databaseName="catalog_cache.db"
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      assetSource={{ assetId: require('../../assets/catalog.db') }}
    >
      <CatalogDbBridge onReady={handleReady} />
      {children}
    </SQLiteProvider>
  );
}
