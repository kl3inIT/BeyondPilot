/**
 * Structured data for search engines and agents (schema.org as JSON-LD), rendered the way the
 * Next.js guide recommends. `<` is escaped so no value can close the script element early.
 */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export { JsonLd };
