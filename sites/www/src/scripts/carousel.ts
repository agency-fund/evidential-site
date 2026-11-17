/** Shared helpers for the rotating and selectable panels (hero slides, testimonials, features, readiness). */

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Marks the element at `index` with `is-on` and clears it from the rest. */
export function showOnly(elements: Element[], index: number): void {
  elements.forEach((element, i) => element.classList.toggle("is-on", i === index));
}

interface RotationOptions {
  /** Element whose hover or keyboard focus temporarily holds the rotation. */
  region: HTMLElement;
  /** Pause/play button; shown only when rotation is active. Its `data-label-pause` / `data-label-play` set the label. */
  toggle: HTMLButtonElement;
  intervalMs: number;
  advance: () => void;
}

/**
 * Advances a carousel on a timer (WCAG 2.2.2): the toggle stops it permanently, while hover and keyboard focus hold
 * it temporarily. Nothing rotates for visitors who prefer reduced motion.
 */
export function autoRotate({ region, toggle, intervalMs, advance }: RotationOptions): void {
  if (prefersReducedMotion()) return;
  let paused = false;
  let hovered = false;
  let focused = false;

  function render() {
    toggle.dataset.state = paused ? "paused" : "playing";
    toggle.setAttribute("aria-label", (paused ? toggle.dataset.labelPlay : toggle.dataset.labelPause) ?? "");
  }

  toggle.hidden = false;
  render();
  toggle.addEventListener("click", () => {
    paused = !paused;
    render();
  });
  region.addEventListener("mouseenter", () => (hovered = true));
  region.addEventListener("mouseleave", () => (hovered = false));
  // Keyboard focus on content holds the rotation, but focus on the toggle itself must not, or "Play" would never resume.
  const holdsFocus = (node: EventTarget | null) => node instanceof Node && node !== toggle && region.contains(node);
  region.addEventListener("focusin", (event) => (focused = holdsFocus(event.target)));
  region.addEventListener("focusout", (event) => (focused = holdsFocus(event.relatedTarget)));
  setInterval(() => {
    if (!paused && !hovered && !focused) advance();
  }, intervalMs);
}
