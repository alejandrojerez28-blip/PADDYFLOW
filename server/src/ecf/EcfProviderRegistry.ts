import type { EcfProviderAdapter } from './EcfProviderAdapter.js';
import { ecfProviderNone } from './EcfProviderNone.js';

export type EcfProviderType = 'NONE' | 'PROVIDER_X' | 'PROVIDER_Y';

const adapters: Record<EcfProviderType, EcfProviderAdapter> = {
  NONE: ecfProviderNone,
  PROVIDER_X: ecfProviderNone, // Placeholder para futuro
  PROVIDER_Y: ecfProviderNone, // Placeholder para futuro
};

/**
 * Obtiene el adapter e-CF según el proveedor configurado en el tenant.
 */
export function getEcfAdapter(provider: EcfProviderType | null | undefined): EcfProviderAdapter {
  const key = provider && provider in adapters ? provider : 'NONE';
  return adapters[key];
}
