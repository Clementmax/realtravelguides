-- Real Travel Guides: managed inline blog images
-- Safe schema change: adds one nullable text-array column.
-- Existing posts are unchanged because the new column starts NULL.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS images text[];

COMMENT ON COLUMN posts.images IS
'Optional ordered list of inline blog image paths, e.g. /images/blog/padua.jpg. Cover remains separate.';
