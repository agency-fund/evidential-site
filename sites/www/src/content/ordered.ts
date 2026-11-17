import { getCollection, type CollectionKey } from "astro:content";

/** Returns a collection's entries in the order they appear in its YAML file. */
export async function ordered<C extends CollectionKey>(collection: C) {
  const entries = await getCollection(collection);
  return entries.sort((a, b) => (a.data as { order: number }).order - (b.data as { order: number }).order);
}
