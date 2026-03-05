import type { EcfProviderAdapter, EcfSendResult, EcfStatusResult } from './EcfProviderAdapter.js';

/**
 * Adapter dummy cuando no hay proveedor e-CF configurado.
 * Devuelve error controlado PROVIDER_NOT_CONFIGURED.
 */
export const ecfProviderNone: EcfProviderAdapter = {
  async sendInvoice(): Promise<EcfSendResult> {
    return {
      success: false,
      error: 'Configura proveedor e-CF',
      code: 'PROVIDER_NOT_CONFIGURED',
    };
  },

  async getStatus(): Promise<EcfStatusResult> {
    return {
      status: 'PENDING',
      message: 'Proveedor e-CF no configurado',
    };
  },

  async downloadXml() {
    return { error: 'Proveedor e-CF no configurado' };
  },
};
