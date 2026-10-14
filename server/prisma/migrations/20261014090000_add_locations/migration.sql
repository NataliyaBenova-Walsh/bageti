-- The three shops. Added here rather than in the seed so every database,
-- including production, gets them on deploy. ON CONFLICT keeps any later edits.
INSERT INTO "Location" ("id", "name", "address", "opensAt", "closesAt", "sortOrder") VALUES
  ('old-town', 'Fika Old Town', '12 Linden Street, Sofia', '08:00', '20:00', 0),
  ('riverside', 'Fika Riverside', '5 Millstone Lane, Sofia', '08:00', '20:00', 1),
  ('garden', 'Fika Garden', '27 Orchard Square, Sofia', '08:00', '20:00', 2)
ON CONFLICT ("id") DO NOTHING;
