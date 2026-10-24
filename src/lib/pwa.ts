interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export interface PwaSnapshot {
  installAvailable: boolean; installed: boolean; updateAvailable: boolean;
  applying: boolean; offlineReady: boolean; error: string;
}
const initialSnapshot: PwaSnapshot = { installAvailable: false, installed: false, updateAvailable: false, applying: false, offlineReady: false, error: '' };
let snapshot = initialSnapshot;
const subscribers = new Set<() => void>();
const updateGuards = new Set<() => Promise<void>>();
let installPrompt: InstallPromptEvent | undefined;
let registration: ServiceWorkerRegistration | undefined;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | undefined;
let registrationAttempt: Promise<ServiceWorkerRegistration> | undefined;
const monitoredRegistrations = new WeakSet<ServiceWorkerRegistration>();
const monitoredWorkers = new WeakSet<ServiceWorker>();
const latestInstalling = new WeakMap<ServiceWorkerRegistration, ServiceWorker>();
let initialized = false;
let installedObserved = false;
let reloadNeeded = false;
let requestedReload = false;
let reloadResolver: (() => void) | undefined;
let lastController: ServiceWorker | null = null;
let statusRequest = 0;
const env = (import.meta as unknown as { env: { PROD?: boolean; BASE_URL?: string } }).env ?? {};
const base = env.BASE_URL ?? '/curiveojr/';
function patch(values: Partial<PwaSnapshot>) {
  const next = { ...snapshot, ...values };
  if (Object.keys(next).every(key => next[key as keyof PwaSnapshot] === snapshot[key as keyof PwaSnapshot])) return;
  snapshot = next; subscribers.forEach(subscriber => subscriber());
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'アプリの更新を確認できませんでした。';
export const getPwaSnapshot = () => snapshot;
export const getPwaServerSnapshot = () => initialSnapshot;
export function subscribePwa(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
export function registerUpdateGuard(handler: () => Promise<void>) { updateGuards.add(handler); return () => { updateGuards.delete(handler); }; }
function updateWaiting() { patch({ updateAvailable: Boolean(registration?.waiting) || reloadNeeded }); }

async function refreshOfflineStatus() {
  const requestId = ++statusRequest;
  const worker = registration?.active ?? navigator.serviceWorker.controller;
  if (!worker || worker.state !== 'activated') { patch({ offlineReady: false }); return; }
  const status = await new Promise<{ type: string; cacheReady?: boolean } | undefined>(resolve => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); resolve(undefined); }, 3000);
    channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
    try { worker.postMessage({ type: 'GET_STATUS' }, [channel.port2]); }
    catch { clearTimeout(timeout); channel.port1.close(); resolve(undefined); }
  });
  if (requestId === statusRequest) patch({ offlineReady: status?.type === 'CURIVEO_STATUS' && status.cacheReady === true });
}
function hasWorker(value: ServiceWorkerRegistration) {
  return [value.installing, value.waiting, value.active].some(worker => worker && worker.state !== 'redundant');
}
function monitorWorker(worker: ServiceWorker | null, owner: ServiceWorkerRegistration) {
  if (!worker || monitoredWorkers.has(worker)) return;
  monitoredWorkers.add(worker);
  const wasInstalling = worker === owner.installing || worker.state === 'installing';
  if (wasInstalling) latestInstalling.set(owner, worker);
  const change = () => {
    if (registration !== owner) return;
    updateWaiting();
    if (worker.state === 'activated') void refreshOfflineStatus();
    else if (worker.state === 'redundant' && wasInstalling) {
      patch({ error: 'アプリのオフライン準備に失敗しました。通信を確認し、更新確認で再試行してください。', ...(owner.active ? {} : { offlineReady: false }) });
    }
  };
  worker.addEventListener('statechange', change); change();
}
function adoptRegistration(value: ServiceWorkerRegistration) {
  registration = value;
  if (!monitoredRegistrations.has(value)) {
    monitoredRegistrations.add(value);
    value.addEventListener('updatefound', () => monitorWorker(value.installing, value));
  }
  monitorWorker(value.installing, value); monitorWorker(value.waiting, value); monitorWorker(value.active, value);
  updateWaiting(); void refreshOfflineStatus(); return value;
}
function registerWorker(): Promise<ServiceWorkerRegistration> {
  if (registrationAttempt) return registrationAttempt;
  const attempt = Promise.resolve().then(() => navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })).then(adoptRegistration);
  registrationAttempt = attempt;
  void attempt.then(() => { if (registrationAttempt === attempt) registrationAttempt = undefined; }, () => { if (registrationAttempt === attempt) registrationAttempt = undefined; });
  return attempt;
}
async function currentRegistration() {
  const value = await navigator.serviceWorker.getRegistration(base);
  // getRegistration may otherwise return a different worker with a broader, origin-wide scope.
  return value?.scope === new URL(base, window.location.href).href ? value : undefined;
}
async function installationSettled(value: ServiceWorkerRegistration, worker = value.installing): Promise<void> {
  if (!worker) {
    if (!hasWorker(value)) throw new Error('オフライン準備が完了していません。通信を確認し、更新確認で再試行してください。');
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', change); };
    const change = () => {
      if (worker.state === 'redundant') { cleanup(); reject(new Error('アプリのオフライン準備に失敗しました。通信を確認し、更新確認で再試行してください。')); }
      else if (['installed', 'activating', 'activated'].includes(worker.state)) { cleanup(); resolve(); }
    };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('オフライン準備の完了をまだ確認できません。しばらくして更新確認を再試行してください。')); }, 20000);
    worker.addEventListener('statechange', change); change();
  });
}
function reloadAfterApproval() {
  if (!requestedReload) return;
  requestedReload = false; reloadNeeded = false;
  patch({ applying: false, updateAvailable: false });
  reloadResolver?.(); reloadResolver = undefined;
  window.location.reload();
}
function captureEvents() {
  if (typeof window === 'undefined') return;
  const mode = window.matchMedia('(display-mode: standalone)');
  const updateInstalled = () => {
    const installed = installedObserved || mode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (installed) installPrompt = undefined;
    patch({ installed, installAvailable: Boolean(installPrompt) && !installed });
  };
  updateInstalled();
  if (typeof mode.addEventListener === 'function') mode.addEventListener('change', updateInstalled);
  else mode.addListener(updateInstalled);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallPromptEvent; updateInstalled(); });
  window.addEventListener('appinstalled', () => { installedObserved = true; installPrompt = undefined; updateInstalled(); });
  if (!('serviceWorker' in navigator)) return;
  lastController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const controller = navigator.serviceWorker.controller;
    if (lastController && controller !== lastController) reloadNeeded = true;
    lastController = controller; updateWaiting(); void refreshOfflineStatus();
    // A different tab may activate the worker; reload only after this tab's successful explicit apply.
    if (requestedReload) reloadAfterApproval();
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'CURIVEO_ACTIVATED') { updateWaiting(); void refreshOfflineStatus(); }
  });
}
captureEvents();

export function initializePwa(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (!('serviceWorker' in navigator) || !env.PROD) return;
  registrationPromise = registerWorker().catch(error => { initialized = false; registrationPromise = undefined; patch({ error: errorMessage(error), offlineReady: false }); return undefined; });
}
export async function installPwa(): Promise<void> {
  const prompt = installPrompt; if (!prompt || snapshot.installed) return;
  installPrompt = undefined; patch({ installAvailable: false, error: '' });
  try {
    await prompt.prompt();
    // Dialog acceptance does not prove installation; appinstalled / standalone confirms it.
    await prompt.userChoice;
  } catch (error) { patch({ error: errorMessage(error) }); throw error; }
}
export async function checkPwaUpdate(): Promise<void> {
  initializePwa(); patch({ error: '' });
  try {
    if (!('serviceWorker' in navigator) || !env.PROD) throw new Error('この環境ではアプリの更新を確認できません。公開版を対応ブラウザで開いてください。');
    await registrationPromise;
    let value = await currentRegistration();
    if (!value || !hasWorker(value)) {
      // register() can resolve before install completes. Failed initial installs leave an empty,
      // detached registration whose update() has no script URL and rejects InvalidStateError.
      value = await registerWorker();
      await installationSettled(value);
    } else {
      adoptRegistration(value);
      if (value.installing) await installationSettled(value);
      else {
        const before = latestInstalling.get(value);
        try { await value.update(); }
        catch (error) {
          if (!(error && typeof error === 'object' && 'name' in error && error.name === 'InvalidStateError')) throw error;
          const current = await currentRegistration();
          if (current && current !== value && hasWorker(current)) {
            value = adoptRegistration(current); await value.update();
          } else value = await registerWorker();
        }
        const latest = latestInstalling.get(value);
        await installationSettled(value, value.installing ?? (latest !== before ? latest ?? null : null));
      }
    }
    updateWaiting(); await refreshOfflineStatus();
    if (!hasWorker(value)) throw new Error('アプリのオフライン準備に失敗しました。通信を確認し、更新確認で再試行してください。');
    patch({ error: '' });
  }
  catch (error) { patch({ error: errorMessage(error) }); throw error; }
}
export async function applyPwaUpdate(): Promise<void> {
  if (snapshot.applying) return;
  const value = registration ?? await registrationPromise; const worker = value?.waiting;
  if (snapshot.applying) return;
  if (!worker && !reloadNeeded) return;
  const controllerBeforeSave = navigator.serviceWorker.controller;
  patch({ applying: true, error: '' });
  try {
    const saved = await Promise.allSettled([...updateGuards].map(handler => Promise.resolve().then(handler)));
    const failed = saved.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
    if (reloadNeeded || (worker?.state === 'activated' && navigator.serviceWorker.controller !== controllerBeforeSave)) {
      requestedReload = true; reloadAfterApproval(); return;
    }
    if (!worker || worker.state === 'redundant' || value?.waiting !== worker) throw new Error('更新の状態が変わりました。更新を確認してから再試行してください。');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { requestedReload = false; reloadResolver = undefined; reject(new Error('更新の切り替えを確認できませんでした。再試行してください。')); }, 15000);
      reloadResolver = () => { clearTimeout(timeout); resolve(); };
      requestedReload = true;
      try { worker.postMessage({ type: 'SKIP_WAITING' }); }
      catch (error) { clearTimeout(timeout); requestedReload = false; reloadResolver = undefined; reject(error); }
    });
  } catch (error) { requestedReload = false; patch({ applying: false, error: errorMessage(error) }); throw error; }
}
