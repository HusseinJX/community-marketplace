-- A product row gets a GALLERY, not just a cover.
--
-- Printify ships a set of mockups per variant — front, back, left, right, a
-- lifestyle shot — and tags each one with the variant ids it depicts. We stored
-- exactly one image, the product's default, which meant two things on a
-- storefront: a shirt only ever showed one angle, and choosing "Navy" left a
-- black shirt on screen. A colour picker that doesn't change the picture is
-- worse than no picker, because the wrong thing is being confirmed.
--
-- Ordered, default first — the first entry is `image_url`, so a card and the
-- top of a product page agree.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[];

COMMENT ON COLUMN products.image_urls IS
  'Ordered gallery for THIS row (this Printify variant). Default mockup first, which matches image_url. NULL/empty for hand-made products, which have one photo.';
