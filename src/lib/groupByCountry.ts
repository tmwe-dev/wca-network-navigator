/**
 * Generic country grouping utility.
 * Used by ActivitiesTab, ContactListPanel, and any list grouped by country.
 */

export interface CountryGroup<T> {
  countryCode: string;
  countryName: string;
  items: T[];
}

/**
 * Groups an array of items by country code, sorted by group size descending.
 *
 * @param items  The items to group
 * @param getCode  Extractor for country code (e.g. item.partners?.country_code)
 * @param getName  Extractor for country name (e.g. item.partners?.country_name)
 */
export function groupByCountry<T>(
  items: T[],
  getCode: (item: T) => string,
  getName: (item: T) => string
): CountryGroup<T>[] {
  const map: Record<string, CountryGroup<T>> = {};

  items.forEach((item) => {
    const code = getCode(item) || "??";
    if (!map[code]) {
      map[code] = {
        countryCode: code,
        countryName: getName(item) || "Sconosciuto",
        items: [],
      };
    }
    map[code].items.push(item);
  });

  return Object.values(map).sort((a, b) => b.items.length - a.items.length);
}
