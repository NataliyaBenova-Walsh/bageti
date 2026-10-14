-- Orders placed before the move to Sweden were priced in euro cents.
-- Reprice them with the products' current SEK prices so totals stay consistent.
UPDATE "OrderItem" AS oi SET "unitPriceCents" = p."priceCents"
FROM "Product" AS p
WHERE oi."productId" = p."id";

UPDATE "Order" AS o SET "totalCents" = t.total
FROM (SELECT "orderId", SUM("unitPriceCents" * "quantity") AS total FROM "OrderItem" GROUP BY "orderId") AS t
WHERE o."id" = t."orderId";
