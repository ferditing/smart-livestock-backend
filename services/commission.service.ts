// services/commission.service.ts
const COMMISSION_RATE = 0.05;

export function calculateCommission(amount: number): number {
  return +(amount * COMMISSION_RATE).toFixed(2);
}