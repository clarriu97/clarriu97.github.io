import { defineCollection, z } from "astro:content"

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    featured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional(),
  }),
})

export const collections = { blog }
