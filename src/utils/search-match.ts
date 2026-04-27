function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

export function matchesSearchQuery(query: string, candidates: string[]) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const compactQuery = compactSearchText(query);

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeSearchText(candidate);
    return (
      normalizedCandidate.includes(normalizedQuery) ||
      compactSearchText(candidate).includes(compactQuery)
    );
  });
}
