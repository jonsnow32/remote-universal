/**
 * Lazy IR Database Provider
 *
 * The bundled ir.db is ~84 MB. Mounting <SQLiteProvider> at app root blocks
 * the JS thread while React Native copies the asset to the documents directory.
 *
 * This module defers that cost until the user actually needs IR:
 *   - When AddDeviceSheet enters the IR setup step
 *   - When RemoteScreen mounts for an IR device
 *
 * Usage (App.tsx):
 *   <IRDatabaseProvider>
 *     {children}
 *   </IRDatabaseProvider>
 *
 * Usage (callers):
 *   const { triggerLoad, status } = useIRDatabase();
 *   await triggerLoad();   // resolves once DB is open and irLocalDb is ready
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { _initIRLocalDb } from './irLocalDb';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IRDbStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface IRDatabaseContextValue {
  /** Current state of the IR database. */
  status: IRDbStatus;
  /**
   * Kick off loading the IR database.  Safe to call multiple times — only the
   * first call starts the copy; all callers receive the same Promise.
   * Resolves when the DB is open and irLocalDb.isIRLocalDbReady() === true.
   */
  triggerLoad(): Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const IRDatabaseContext = createContext<IRDatabaseContextValue>({
  status: 'idle',
  triggerLoad: () => Promise.resolve(),
});

// ─── Internal bridge ──────────────────────────────────────────────────────────

/**
 * Rendered inside <SQLiteProvider>.  Grabs the DB from context, stores it in
 * the irLocalDb singleton, then fires the onReady callback.
 */
function IRDbBridge({ onReady }: { onReady: () => void }): null {
  const db = useSQLiteContext();
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    _initIRLocalDb(db);
    onReady();
  }, [db, onReady]);
  return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function IRDatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [status, setStatus] = useState<IRDbStatus>('idle');

  // Mutable refs so callbacks don't go stale across re-renders.
  const statusRef = useRef<IRDbStatus>('idle');
  const triggered = useRef(false);
  const pendingResolvers = useRef<Array<() => void>>([]);

  const updateStatus = (s: IRDbStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const triggerLoad = useCallback((): Promise<void> => {
    return new Promise<void>(resolve => {
      if (statusRef.current === 'ready') {
        resolve();
        return;
      }
      if (statusRef.current === 'error') {
        // Resolve anyway — callers fall back to HTTP in this case.
        resolve();
        return;
      }

      // Register this caller to be notified when ready.
      pendingResolvers.current.push(resolve);

      if (!triggered.current) {
        triggered.current = true;
        updateStatus('loading');
      }
    });
  }, []);

  const handleReady = useCallback(() => {
    updateStatus('ready');
    for (const resolve of pendingResolvers.current) resolve();
    pendingResolvers.current = [];
  }, []);

  return (
    <IRDatabaseContext.Provider value={{ status, triggerLoad }}>
      {status !== 'idle' && (
        <SQLiteProvider
          databaseName="ir.db"
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          assetSource={{ assetId: require('../../assets/ir.db') }}
        >
          <IRDbBridge onReady={handleReady} />
        </SQLiteProvider>
      )}
      {children}
    </IRDatabaseContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIRDatabase(): IRDatabaseContextValue {
  return useContext(IRDatabaseContext);
}
