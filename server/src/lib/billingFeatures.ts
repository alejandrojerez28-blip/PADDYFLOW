/**
 * Features habilitadas por plan (PLAN_BASIC, PLAN_PRO)
 */
export type BillingPlan = 'basic' | 'pro';

export interface PlanFeatures {
  maxUsers: number;
  has3D: boolean;
  hasSavedViews: boolean;
}

export function getTenantFeatures(plan: BillingPlan | string | null): PlanFeatures {
  switch (plan) {
    case 'pro':
      return {
        maxUsers: 25,
        has3D: true,
        hasSavedViews: true,
      };
    case 'basic':
    default:
      return {
        maxUsers: 5,
        has3D: false,
        hasSavedViews: false,
      };
  }
}
