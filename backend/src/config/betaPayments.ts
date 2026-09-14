export const BETA_PACKAGES = {
  PLUS_BETA: { planCode: 'PLUS', credits: 300, amountMinor: 1500, currency: 'PEN' },
  PRO_BETA: { planCode: 'PRO', credits: 1200, amountMinor: 4000, currency: 'PEN' },
} as const;
export type BetaPackageId = keyof typeof BETA_PACKAGES;
