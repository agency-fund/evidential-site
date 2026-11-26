import { defineCollection, reference } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";
import { parse } from "yaml";
import { iconNames } from "./icons";

/**
 * Loads a YAML list from src/content. Collections are not returned in file order, so each entry records its
 * position as `order`; render them with `ordered()` from src/content/ordered.ts.
 */
const yaml = (name: string) =>
  file(`src/content/${name}.yaml`, {
    parser: (text) => (parse(text) as Record<string, unknown>[]).map((entry, order) => ({ ...entry, order })),
  });

const order = z.number().int().nonnegative();

const partners = defineCollection({
  loader: yaml("partners"),
  schema: ({ image }) =>
    z.object({
      order,
      name: z.string(),
      logo: image(),
      wordmark: z.boolean().default(false),
      marqueeHeight: z.number().int().positive(),
    }),
});

const stats = defineCollection({
  loader: yaml("stats"),
  schema: z.object({ order, value: z.number().int().nonnegative(), label: z.string() }),
});

const testimonials = defineCollection({
  loader: yaml("testimonials"),
  schema: z.object({ order, partner: reference("partners"), quote: z.string(), name: z.string(), role: z.string() }),
});

const arm = z.object({ label: z.string(), value: z.number() });

const partnerTests = defineCollection({
  loader: yaml("partner-tests"),
  schema: z.object({
    order,
    partner: reference("partners"),
    logoHeight: z.number().int().positive().optional(),
    stat: z.string(),
    statIcon: z.enum(["whatsapp"]).optional(),
    statLabel: z.string(),
    title: z.string(),
    body: z.string(),
    result: z
      .object({
        type: z.string(),
        title: z.string(),
        description: z.string(),
        control: arm,
        treatment: arm.extend({ lift: z.string() }),
        population: z.string(),
        winner: z.string(),
        note: z.string(),
      })
      .optional(),
  }),
});

const iconItem = z.object({ order, icon: z.enum(iconNames), title: z.string(), body: z.string() });

const why = defineCollection({ loader: yaml("why"), schema: iconItem });

const steps = defineCollection({ loader: yaml("steps"), schema: iconItem });

const comparison = defineCollection({
  loader: yaml("comparison"),
  schema: z.object({ order, category: z.string(), builtFor: z.string(), measures: z.string(), assumes: z.string() }),
});

const features = defineCollection({
  loader: yaml("features"),
  schema: z.object({
    order,
    title: z.string(),
    summary: z.string(),
    useWhen: z.string(),
    screen: z.enum(["experiments", "bandit-analysis", "datasources"]),
    alt: z.string(),
    crop: z.object({ width: z.number(), left: z.number(), top: z.number() }),
  }),
});

const readiness = defineCollection({
  loader: yaml("readiness"),
  schema: z.object({
    order,
    label: z.string(),
    cost: z.string(),
    service: z.string().optional(),
    body: z.string(),
  }),
});

export const collections = {
  comparison,
  features,
  partnerTests,
  partners,
  readiness,
  stats,
  steps,
  testimonials,
  why,
};
