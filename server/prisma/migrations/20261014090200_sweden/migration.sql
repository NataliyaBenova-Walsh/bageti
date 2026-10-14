-- The bakery moved to Sweden: prices in SEK (stored in öre, 1/100 krona),
-- one shop each in Stockholm, Gothenburg and Malmö, open 08:00–18:00 Swedish time.
UPDATE "Product" AS p SET "priceCents" = v.price
FROM (VALUES
  ('Almond Cake', 4500),
  ('Carrot Cake', 4900),
  ('Nutella Biscuit Cake', 5200),
  ('Chocolate Tart', 5500),
  ('Raspberry Tart', 5500),
  ('Lemon Tart', 4900),
  ('Strawberry Tartlet', 3900),
  ('Chocolate Hazelnut Tartlet', 3900),
  ('Brownie', 3500),
  ('Chocolate Chip Cookie', 2500),
  ('Financier', 2500),
  ('Croissant', 3200),
  ('Cinnamon Bun', 3800),
  ('Oatmeal Raisin Cookie', 2500),
  ('Ginger Honey Cookie', 2200),
  ('Mini Pavlova', 4200),
  ('Salmon Sandwich', 8900),
  ('Prosciutto Sandwich', 8500),
  ('Mozzarella Sandwich', 7900),
  ('Salami Sandwich', 7500),
  ('Cheddar Spinach Muffin', 3900),
  ('Goat Cheese and Walnut Quiche', 6500),
  ('Quiche Lorraine', 6500),
  ('Spinach Pie', 4900),
  ('Einkorn Bread', 6900),
  ('Rye Bread', 5900),
  ('Wholewheat Bread', 4900),
  ('Italian Baguette', 3500),
  ('Milk and Butter Bread', 5500),
  ('Ciabatta', 3500),
  ('Sourdough Bread Roll', 1500),
  ('Walnut Bread', 6900)
) AS v(name, price)
WHERE p."name" = v.name;

UPDATE "Location" SET "name" = 'Fika Stockholm', "address" = 'Lindgatan 12, Stockholm', "opensAt" = '08:00', "closesAt" = '18:00' WHERE "id" = 'old-town';
UPDATE "Location" SET "name" = 'Fika Gothenburg', "address" = 'Kvarnstensgränd 5, Gothenburg', "opensAt" = '08:00', "closesAt" = '18:00' WHERE "id" = 'riverside';
UPDATE "Location" SET "name" = 'Fika Malmö', "address" = 'Fruktträdgårdstorget 27, Malmö', "opensAt" = '08:00', "closesAt" = '18:00' WHERE "id" = 'garden';
