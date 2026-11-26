/** Wires Collapsible via the disclosure module. */

import { mount, makeDisclosure } from "@cloudflare/nimbus-docs/client";

function matchesHash(root: HTMLElement): boolean {
  const raw = window.location.hash.slice(1);
  if (!raw) return false;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return false;
  }
  return root.id === id || root.querySelector(`[id="${CSS.escape(id)}"]`) !== null;
}

function initCollapsible(root: HTMLElement): () => void {
  const trigger = root.querySelector<HTMLElement>("[data-nb-collapsible-trigger]");
  const content = root.querySelector<HTMLElement>("[data-nb-collapsible-content]");

  if (!trigger || !content) return () => {};

  const defaultOpen = root.dataset.nbDefaultOpen === "true" || matchesHash(root);

  const disclosure = makeDisclosure({
    trigger,
    content,
    defaultOpen,
  });

  const onHashChange = () => {
    if (matchesHash(root)) disclosure.open();
  };
  window.addEventListener("hashchange", onHashChange);

  return () => {
    window.removeEventListener("hashchange", onHashChange);
    disclosure.destroy();
  };
}

mount("[data-nb-collapsible]", initCollapsible);
