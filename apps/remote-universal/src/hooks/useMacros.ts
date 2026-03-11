import { useState, useCallback, useEffect } from 'react';
import {
  StoredMacro,
  loadMacros,
  saveMacros,
  upsertMacro,
  deleteMacro as deleteMacroFromStore,
} from '../lib/macroStore';

export function useMacros() {
  const [macros, setMacros] = useState<StoredMacro[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await loadMacros();
    setMacros(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (
    draft: Omit<StoredMacro, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StoredMacro> => {
    const now = Date.now();
    const macro: StoredMacro = {
      ...draft,
      id: `macro_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = await upsertMacro(macro);
    setMacros(updated);
    return macro;
  }, []);

  const update = useCallback(async (
    id: string,
    patch: Partial<Omit<StoredMacro, 'id' | 'createdAt'>>,
  ): Promise<void> => {
    const all = await loadMacros();
    const idx = all.findIndex(m => m.id === id);
    if (idx < 0) return;
    const updated = await upsertMacro({ ...all[idx], ...patch, updatedAt: Date.now() });
    setMacros(updated);
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    const updated = await deleteMacroFromStore(id);
    setMacros(updated);
  }, []);

  const reorder = useCallback(async (
    fromIndex: number,
    toIndex: number,
  ): Promise<void> => {
    const next = [...macros];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setMacros(next);
    await saveMacros(next);
  }, [macros]);

  return { macros, isLoading, refresh, create, update, remove, reorder };
}
