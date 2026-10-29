// Memory only: use for public catalog data, never orders, sessions or proofs.
export function createQueryResource(loader, { maxAge = 30000, now = Date.now } = {}) {
  let snapshot = { data: undefined, error: null, loading: true };
  let updatedAt = -Infinity;
  let pending = null;
  let liveUpdates = [];
  const listeners = new Set();
  const publish = next => { snapshot = next; listeners.forEach(listener => listener()); };
  const resource = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    load() {
      if (pending) return pending;
      if (now() - updatedAt < maxAge) return Promise.resolve(snapshot.data);
      liveUpdates = [];
      publish({ ...snapshot, error: null, loading: snapshot.data === undefined });
      pending = Promise.resolve().then(loader).then(data => {
        // Replay changes received during this request over its snapshot so
        // an older HTTP response cannot undo a live stock update.
        data = liveUpdates.reduce((current, update) => update(current), data);
        updatedAt = now();
        publish({ data, error: null, loading: false });
        return snapshot.data;
      }).catch(error => {
        publish({ ...snapshot, error, loading: false });
        return snapshot.data;
      }).finally(() => { pending = null; liveUpdates = []; });
      return pending;
    },
    update(updater) {
      const update = typeof updater === 'function' ? updater : () => updater;
      if (pending) liveUpdates.push(update);
      if (snapshot.data === undefined) return;
      // A partial event cannot extend the freshness of the entire list.
      const data = update(snapshot.data);
      publish({ data, error: null, loading: false });
    },
    invalidate() { updatedAt = -Infinity; },
  };
  return resource;
}
