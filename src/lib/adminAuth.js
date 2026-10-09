// A session is never evidence of administrator membership.
export function createAdminAuth(client, { configured = true, timeoutMs = 4000 } = {}) {
  let state = { user: null, isAdmin: false, loading: true, error: null };
  let active = false;
  let generation = 0;
  let loginGeneration = 0;
  let scheduled;
  let initialTimeout;
  let subscription;
  let acceptSessions = true;
  const listeners = new Set();
  const denied = (message) => ({ user: null, isAdmin: false, loading: false, error: message ? new Error(message) : null });
  const publish = (next) => {
    state = next;
    if (active) listeners.forEach(listener => listener(state));
  };
  const invalidate = () => {
    clearTimeout(scheduled);
    clearTimeout(initialTimeout);
    return ++generation;
  };
  async function verify(session, version) {
    if (!session?.user?.id || !session.access_token) {
      if (active && version === generation) publish(denied());
      return false;
    }
    if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
      if (active && version === generation) publish(denied('Your session has expired. Please sign in again.'));
      return false;
    }
    let timer;
    try {
      const result = await Promise.race([
        client.rpc('is_admin'),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
      ]);
      if (!active || version !== generation) return false;
      if (result.error || result.data !== true) {
        publish(denied(result.error ? 'Unable to verify administrator access. Please try again.' : 'This account does not have administrator access.'));
        return false;
      }
      publish({ user: session.user, isAdmin: true, loading: false, error: null });
      return true;
    } catch {
      if (active && version === generation) publish(denied('Unable to verify administrator access. Please try again.'));
      return false;
    } finally { clearTimeout(timer); }
  }
  // Auth callbacks run under Supabase's session lock. RPCs must be deferred.
  function receiveSession(session) {
    if (!active) return;
    if (!acceptSessions) { invalidate(); publish(denied()); return; }
    const version = invalidate();
    publish(session ? { ...denied(), loading: true } : denied());
    if (session) scheduled = setTimeout(() => { void verify(session, version); }, 0);
  }
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      if (active) return;
      active = true;
      const version = invalidate();
      if (!configured) { publish(denied('Authentication is not configured.')); return; }
      publish({ ...denied(), loading: true });
      subscription = client.auth.onAuthStateChange((_event, session) => receiveSession(session)).data.subscription;
      initialTimeout = setTimeout(() => {
        if (active && generation === version) { invalidate(); publish(denied('Unable to load your session. Please sign in again.')); }
      }, timeoutMs);
      void client.auth.getSession().then(({ data, error }) => {
        if (!active || generation !== version) return;
        if (error) { invalidate(); publish(denied('Unable to load your session. Please sign in again.')); }
        else receiveSession(data?.session);
      }).catch(() => {
        if (active && generation === version) { invalidate(); publish(denied('Unable to load your session. Please sign in again.')); }
      });
    },
    stop() { active = false; invalidate(); ++loginGeneration; subscription?.unsubscribe(); subscription = undefined; },
    async login(email, password) {
      if (!configured || !active) return { data: null, error: new Error('Authentication is not configured.') };
      const attempt = ++loginGeneration;
      acceptSessions = true;
      invalidate(); publish(denied());
      try {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (attempt !== loginGeneration || !active) return { data: null, error: new Error('Sign-in was cancelled.') };
        if (result.error) {
          acceptSessions = false;
          invalidate(); publish(denied('Unable to sign in. Check your credentials and try again.'));
          return { data: null, error: state.error };
        }
        const version = invalidate(); publish({ ...denied(), loading: true });
        const accepted = await verify(result.data?.session, version);
        if (accepted) return result;
        const verificationError = state.error || new Error('Administrator access was not verified.');
        acceptSessions = false;
        invalidate();
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* Local state remains denied. */ }
        publish(denied(verificationError.message));
        return { data: null, error: verificationError };
      } catch {
        if (attempt === loginGeneration && active) { acceptSessions = false; invalidate(); publish(denied('Unable to sign in. Please try again.')); }
        return { data: null, error: new Error('Unable to sign in. Please try again.') };
      }
    },
    async logout() {
      acceptSessions = false;
      ++loginGeneration; invalidate(); publish(denied());
      try { return await client.auth.signOut({ scope: 'local' }); }
      catch { return { error: new Error('Unable to complete sign-out. Please try again.') }; }
    },
  };
}
