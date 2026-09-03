export type SmoothScrollOptions = {
  offset?: number;
  duration?: number;
  behavior?: ScrollBehavior;
  force?: boolean;
};

export function scrollToPosition(
  top: number,
  {
    duration = 1.2,
    behavior = "smooth",
    force,
  }: SmoothScrollOptions = {},
) {
  if (behavior === "smooth" && window.__lenis) {
    window.__lenis.scrollTo(top, { duration, force });
    return;
  }
  window.scrollTo({ top, left: 0, behavior });
}

export function scrollToElement(
  element: HTMLElement,
  { offset = 0, ...options }: SmoothScrollOptions = {},
) {
  const top = element.getBoundingClientRect().top + window.scrollY + offset;
  scrollToPosition(top, options);
}
