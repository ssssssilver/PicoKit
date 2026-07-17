export type LocalizedSearchValue = {
  zh: string
  en: string
}

export type LocalizeSearchValue = (zh: string, en: string) => string

export function buildLocalizedSearchText(
  values: LocalizedSearchValue[],
  localize: LocalizeSearchValue,
) {
  return values
    .flatMap((value) => [value.zh, value.en, localize(value.zh, value.en)])
    .join(" ")
    .toLocaleLowerCase()
}

export function matchesLocalizedQuery(
  query: string,
  values: LocalizedSearchValue[],
  localize: LocalizeSearchValue,
) {
  const normalized = query.trim().toLocaleLowerCase()
  return !normalized || buildLocalizedSearchText(values, localize).includes(normalized)
}
