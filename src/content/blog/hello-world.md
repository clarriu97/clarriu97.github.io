---
title: "Hello World: the blog is live"
description: "A short test post to validate the blog layout, navigation, and content pipeline."
pubDate: 2026-04-06
featured: true
tags:
  - meta
  - site
draft: false
---

This is a **sample post** so you can see how articles look on this site. Replace or extend it whenever you want.

## What you get

- Markdown files under `src/content/blog/` — one file per post.
- Frontmatter for metadata (`title`, `description`, `pubDate`, `featured`, and more).
- Automatic listing on [`/blog`](/blog) and a dedicated page per slug.

## Adding a new post

Create a new `.md` file next to this one, fill in the frontmatter, and write the body in Markdown. Rebuild (or use the dev server) and the post appears in the list and at `/blog/your-file-name`.

## Images

Put image files under `public/` (for example `public/blog/my-photo.webp`). In Markdown, reference them **from the site root** with a leading slash:

```text
![Description for accessibility](/blog/my-photo.webp)
```

You can also use a `<figure>` if you want a caption:

<figure>
  <img src="/blog/sample-terminal.webp" alt="Terminal showing weather-tty CLI output" width="840" height="513" loading="lazy" decoding="async" />
  <figcaption>Example asset at <code>public/blog/sample-terminal.webp</code> — same look as the rest of the site.</figcaption>
</figure>

---

Thanks for reading — this paragraph is only here to show a horizontal rule and a bit of spacing.
