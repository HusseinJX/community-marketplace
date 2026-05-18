-- Backfill product images for Zahab Energy seed data (CCLA parity)
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1000&q=70'
  WHERE name = 'Solar Home System 50W' AND member_id = '89516919-256f-4a95-96df-fc9d285f664a';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=70'
  WHERE name = 'Solar Panel 200W' AND member_id = '89516919-256f-4a95-96df-fc9d285f664a';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1000&q=70'
  WHERE name = 'Energy Consultation' AND member_id = '89516919-256f-4a95-96df-fc9d285f664a';
