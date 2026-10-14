-- Not everything is baked (sandwiches, for example), so "Baking" becomes "Preparing".
-- Renaming the value keeps existing orders in that state.
ALTER TYPE "OrderStatus" RENAME VALUE 'BAKING' TO 'PREPARING';
