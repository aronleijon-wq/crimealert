// The iPhone's small taps under your finger (CrimeAlertHapticsPlugin in ios/App/App/AppDelegate.swift,
// from app version 1.3). Without the plugin, on the web and in older app versions, nothing happens.
import { nativePlugin } from '@/lib/nativeApp';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

interface HapticsPlugin {
  impact(options: { style: ImpactStyle }): Promise<void>;
  selection(): Promise<void>;
  notification(options: { type: 'success' | 'warning' | 'error' }): Promise<void>;
}

const plugin = () => nativePlugin<HapticsPlugin>('CrimeAlertHaptics');
const quietly = (run: (p: HapticsPlugin) => Promise<void>) => {
  plugin().then((p) => (p ? run(p) : undefined)).catch(() => {});
};

export const haptics = {
  /** Something moved into place: a sheet, a button pressed */
  impact: (style: ImpactStyle = 'light') => quietly((p) => p.impact({ style })),
  /** A choice changed: a tab, a segment, a filter */
  selection: () => quietly((p) => p.selection()),
  success: () => quietly((p) => p.notification({ type: 'success' })),
  warning: () => quietly((p) => p.notification({ type: 'warning' })),
  error: () => quietly((p) => p.notification({ type: 'error' })),
};
