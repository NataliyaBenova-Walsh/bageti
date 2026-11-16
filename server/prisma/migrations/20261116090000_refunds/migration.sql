-- A card order that staff cancelled after it was paid, with the money returned on Stripe
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
