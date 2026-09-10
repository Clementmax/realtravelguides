REAL TRAVEL GUIDES — MANAGED BLOG IMAGE SYSTEM

WHAT THIS PACKAGE DOES

This is the permanent structure for blog photographs.

• Existing body HTML is preserved.
• Existing inline images are preserved.
• The existing cover/thumbnail remains separate.
• Video posts still show the video in place of the cover at the top.
• A new optional Supabase field called "images" stores up to three or more ordered image paths.
• The article page automatically places up to three managed images through the body.
• It will not insert a managed image if the same image is already the cover or already appears in the body.
• Posts with no value in "images" behave exactly as they do now.

FILES

app/post/[slug]/page.tsx
lib/types.ts
supabase/add-post-images-column.sql
reports/current-blog-image-audit.csv

SAFE ROLLOUT ORDER

1. In Supabase SQL Editor, run supabase/add-post-images-column.sql.
2. Unzip this package into the root of the realtravelguides project, allowing it to replace the two code files.
3. In GitHub Desktop, review the two changed code files, commit, and push.
4. Do not populate the images field yet unless the image matches have been reviewed.

FUTURE BLOG WORKFLOW

For a new blog:
1. Add its photographs to public/images/blog/.
2. Keep the chosen hero/thumbnail in the existing cover field.
3. Put the remaining desired image paths in the new images field in the order you want them used.
   Example:
   {"/images/blog/padua-basilica.jpg","/images/blog/padua-market.jpg","/images/blog/padua-canal.jpg"}
4. The article page will distribute them automatically.

IMPORTANT

The new system is deliberately deterministic. It does not guess filenames on every page load. Matching is done once, saved in Supabase, and then the website always uses the same photographs.
