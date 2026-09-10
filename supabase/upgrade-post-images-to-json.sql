-- Upgrade the empty posts.images column from text[] to structured JSON.
-- Existing NULL values remain NULL. No blog body, cover, video or other data is changed.

ALTER TABLE posts
ALTER COLUMN images TYPE jsonb
USING CASE
  WHEN images IS NULL THEN NULL
  ELSE to_jsonb(images)
END;

COMMENT ON COLUMN posts.images IS
'Ordered managed inline images as JSON objects: [{"src":"/images/blog/example.jpg","alt":"Useful image description","caption":"Optional visible caption"}].';
