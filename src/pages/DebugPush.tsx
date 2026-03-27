import { useMemo } from 'react';
import { BellRing, Bug, RefreshCw, Smartphone } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const DebugPush = () => {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    refreshStatus,
    sendTestNotification,
    serviceWorkerStatus,
    deviceInfo,
    backendConfig,
    subscription,
    databaseSubscriptions,
    serviceWorkerMessages,
    lastError,
    lastTestResult,
  } = usePushNotifications();

  const manifestChecks = useMemo(
    () => [
      { label: 'display: standalone', ok: true, value: 'Konfigurerad i PWA-manifestet' },
      { label: 'Service worker-stöd', ok: isSupported, value: isSupported ? 'Stöds i denna enhet/webbläsare' : 'Stöds inte' },
      { label: 'iOS installerad app', ok: !deviceInfo.isIos || deviceInfo.isStandalone, value: deviceInfo.isIos ? (deviceInfo.isStandalone ? 'Installerad via hemskärm' : 'Inte installerad via hemskärm') : 'Ej iOS' },
    ],
    [deviceInfo.isIos, deviceInfo.isStandalone, isSupported]
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="p-4 md:p-6 grid-overlay">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Debug Push</h1>
              <p className="text-sm text-muted-foreground">Verifiera service worker, behörigheter, subscription och testnotis end-to-end.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => refreshStatus()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera status
              </Button>
              <Button size="sm" onClick={() => sendTestNotification()} disabled={loading || !isSubscribed}>
                <BellRing className="h-4 w-4" />
                Skicka testnotis
              </Button>
            </div>
          </div>

          {lastError && (
            <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-foreground">Senaste fel</p>
              <p className="text-sm text-muted-foreground mt-1">{lastError}</p>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">Service Worker</h2>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Stöds: <span className="text-foreground">{isSupported ? 'Ja' : 'Nej'}</span></p>
                <p>Registrerad: <span className="text-foreground">{serviceWorkerStatus.registered ? 'Ja' : 'Nej'}</span></p>
                <p>Aktiv: <span className="text-foreground">{serviceWorkerStatus.active ? 'Ja' : 'Nej'}</span></p>
                <p>Waiting: <span className="text-foreground">{serviceWorkerStatus.waiting ? 'Ja' : 'Nej'}</span></p>
                <p>Installing: <span className="text-foreground">{serviceWorkerStatus.installing ? 'Ja' : 'Nej'}</span></p>
                <p>Controller: <span className="text-foreground">{serviceWorkerStatus.controller ? 'Ja' : 'Nej'}</span></p>
                <p>State: <span className="text-foreground">{serviceWorkerStatus.state ?? '—'}</span></p>
                <p className="break-all">Script: <span className="text-foreground">{serviceWorkerStatus.scriptURL ?? '—'}</span></p>
                <p className="break-all">Scope: <span className="text-foreground">{serviceWorkerStatus.scope ?? '—'}</span></p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Senaste SW-loggar</p>
                <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{serviceWorkerMessages.length ? serviceWorkerMessages.join('\n') : 'Inga service worker-meddelanden ännu.'}</pre>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">Behörighet & enhet</h2>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Notification permission: <span className="text-foreground">{permission}</span></p>
                <p>Aktiv subscription i webbläsaren: <span className="text-foreground">{isSubscribed ? 'Ja' : 'Nej'}</span></p>
                <p>iOS: <span className="text-foreground">{deviceInfo.isIos ? 'Ja' : 'Nej'}</span></p>
                <p>Standalone/PWA: <span className="text-foreground">{deviceInfo.isStandalone ? 'Ja' : 'Nej'}</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => subscribe()} disabled={loading || permission === 'denied'}>
                  Aktivera push
                </Button>
                <Button variant="outline" size="sm" onClick={() => unsubscribe()} disabled={loading || !isSubscribed}>
                  Stäng av push
                </Button>
              </div>
              <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{subscription ? formatJson(subscription) : 'Ingen aktiv PushSubscription i webbläsaren.'}</pre>
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Backend & VAPID</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>VAPID_PUBLIC_KEY tillgänglig: <span className="text-foreground">{backendConfig?.hasPublicKey ? 'Ja' : 'Nej'}</span></p>
                <p>VAPID_PRIVATE_KEY tillgänglig: <span className="text-foreground">{backendConfig?.hasPrivateKey ? 'Ja' : 'Nej'}</span></p>
                <p>Backend URL tillgänglig: <span className="text-foreground">{backendConfig?.hasSupabaseUrl ? 'Ja' : 'Nej'}</span></p>
                <p>Service role key tillgänglig: <span className="text-foreground">{backendConfig?.hasServiceRoleKey ? 'Ja' : 'Nej'}</span></p>
                <p className="break-all">VAPID public key: <span className="text-foreground">{backendConfig?.vapidPublicKey ?? '—'}</span></p>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Databasstatus</h2>
              <p className="text-sm text-muted-foreground">Sparade subscriptions för inloggad användare: <span className="text-foreground">{databaseSubscriptions.length}</span></p>
              <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{databaseSubscriptions.length ? formatJson(databaseSubscriptions) : 'Inga push_subscriptions sparade för användaren.'}</pre>
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Manifest & plattformskrav</h2>
            <div className="grid gap-2 md:grid-cols-3">
              {manifestChecks.map((item) => (
                <div key={item.label} className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.value}</p>
                  <p className="text-xs mt-2 text-foreground">{item.ok ? 'OK' : 'Åtgärd krävs'}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Resultat från testnotis</h2>
            <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{lastTestResult ? formatJson(lastTestResult) : 'Ingen testnotis har skickats ännu.'}</pre>
          </section>
        </div>
      </main>
    </div>
  );
};

export default DebugPush;
