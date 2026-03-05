/**
 * Interfaz agnóstica para proveedores de e-CF (Comprobante Fiscal Electrónico).
 * Permite integrar distintos proveedores autorizados por la DGII RD.
 */
export interface EcfSendResult {
  success: boolean;
  trackingId?: string;
  error?: string;
  code?: 'PROVIDER_NOT_CONFIGURED' | 'SEND_FAILED' | 'INVALID_DOCUMENT';
}

export interface EcfStatusResult {
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  message?: string;
  xmlUrl?: string;
}

export interface EcfProviderAdapter {
  /** Envía factura al proveedor e-CF */
  sendInvoice(documentId: string): Promise<EcfSendResult>;

  /** Obtiene estado de transmisión */
  getStatus(trackingId: string): Promise<EcfStatusResult>;

  /** Descarga XML del comprobante */
  downloadXml(trackingId: string): Promise<{ url?: string; content?: string; error?: string }>;

  /** Anula factura (opcional) */
  cancelInvoice?(trackingId: string): Promise<{ success: boolean; error?: string }>;
}
