/** Usuario sin campos sensibles (passwordHash nunca expuesto) */
export interface SafeUser {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
