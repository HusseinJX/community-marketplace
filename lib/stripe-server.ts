import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

export const PLATFORM_FEE = 0.05

export function calculateFees(totalCents: number) {
  const platformFee = Math.round(totalCents * PLATFORM_FEE)
  return { platformFee, vendorAmount: totalCents - platformFee }
}
