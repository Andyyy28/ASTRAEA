import { useEffect, useSyncExternalStore } from 'react';
import { publicCatalog } from './publicCatalog';
const EMPTY_ROWS = [];

export function useCatalogQuery(name) {
  const resource = publicCatalog[name];
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot);
  useEffect(() => { void resource.load(); }, [resource]);
  return { ...snapshot, data: snapshot.data ?? EMPTY_ROWS, update: resource.update, reload: resource.load };
}
