/**
 * Which sides of a table scrolled sideways still hide something: its start once it has moved, its
 * end until it reaches it. A pixel of slack absorbs the fractions a zoomed screen reports.
 */
function scrollEdges(scrollLeft: number, clientWidth: number, scrollWidth: number) {
  return { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
}

export { scrollEdges };
