REAL TRAVEL GUIDES — STRUCTURED BLOG IMAGE METADATA

This replaces the first simple text-array version of the managed image system.

WHY
Each new managed photograph can now have:
- src: the image path
- alt: concise accessibility/SEO description
- caption: optional reader-visible caption

The filename is never shown automatically.

EXAMPLE VALUE IN SUPABASE
[
  {
    "src": "/images/blog/Basilica of St Anthony Padua.jpeg",
    "alt": "Basilica of Saint Anthony in Padua, Italy",
    "caption": "Basilica of Saint Anthony, Padua"
  }
]

Existing manually inserted images/captions in body HTML are untouched.
Existing cover images remain separate.
If caption is blank/null, nothing is displayed beneath the image.

ROLLOUT
1. Run supabase/upgrade-post-images-to-json.sql in Supabase SQL Editor.
2. Merge this ZIP into the project root.
3. Review app/post/[slug]/page.tsx and lib/types.ts in GitHub Desktop.
4. Commit and push.
5. Only after that should managed image metadata be populated.
