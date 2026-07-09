// Best-effort country from a freeform GitHub `location` string → a flag code
// (lowercase, matching public/badges/flags/<code>.png), or null. Usually an ISO
// 3166-1 alpha-2 code; the UK home nations resolve to their OWN flag rather than
// the Union Flag (scotland → sct, wales → wls, england → eng, NI →
// nir), since they're separate football sides (see lib/countries UK_NATIONS).
// GitHub has no structured country, so this matches country names/aliases, full
// US state names, and major cities. Unknowns return null (no flag) rather than
// a wrong guess — 2-letter abbreviations are skipped on purpose (DE = Germany
// or Delaware, etc.).

const COUNTRY: Record<string, string> = {
  "united states": "us", "united states of america": "us", usa: "us", america: "us",
  "united kingdom": "gb", uk: "gb", britain: "gb", "great britain": "gb",
  england: "eng", scotland: "sct", wales: "wls", "northern ireland": "nir",
  canada: "ca", germany: "de", deutschland: "de", france: "fr", india: "in", bharat: "in",
  china: "cn", japan: "jp", nippon: "jp", brazil: "br", brasil: "br", russia: "ru", "russian federation": "ru",
  netherlands: "nl", holland: "nl", "the netherlands": "nl", spain: "es", españa: "es", espana: "es",
  italy: "it", italia: "it", australia: "au", sweden: "se", sverige: "se", poland: "pl", polska: "pl",
  ukraine: "ua", singapore: "sg", "south korea": "kr", korea: "kr", "republic of korea": "kr",
  switzerland: "ch", schweiz: "ch", suisse: "ch", finland: "fi", suomi: "fi", norway: "no", norge: "no",
  denmark: "dk", danmark: "dk", ireland: "ie", austria: "at", österreich: "at", osterreich: "at",
  belgium: "be", belgique: "be", portugal: "pt", argentina: "ar", mexico: "mx", méxico: "mx",
  "czech republic": "cz", czechia: "cz", romania: "ro", greece: "gr", turkey: "tr", türkiye: "tr", turkiye: "tr",
  indonesia: "id", "new zealand": "nz", "south africa": "za", nigeria: "ng", egypt: "eg",
  pakistan: "pk", bangladesh: "bd", vietnam: "vn", "viet nam": "vn", thailand: "th", philippines: "ph",
  malaysia: "my", "hong kong": "hk", taiwan: "tw", colombia: "co", chile: "cl", peru: "pe", venezuela: "ve",
  hungary: "hu", bulgaria: "bg", serbia: "rs", croatia: "hr", slovakia: "sk", slovenia: "si",
  lithuania: "lt", latvia: "lv", estonia: "ee", iceland: "is", luxembourg: "lu", belarus: "by",
  kazakhstan: "kz", "saudi arabia": "sa", "united arab emirates": "ae", uae: "ae", qatar: "qa",
  iran: "ir", iraq: "iq", morocco: "ma", kenya: "ke", ghana: "gh", ethiopia: "et", tunisia: "tn",
  algeria: "dz", "sri lanka": "lk", nepal: "np", cambodia: "kh", myanmar: "mm", ecuador: "ec",
  uruguay: "uy", "costa rica": "cr", cuba: "cu", "dominican republic": "do", guatemala: "gt",
  bolivia: "bo", paraguay: "py", armenia: "am", azerbaijan: "az", cyprus: "cy", malta: "mt", moldova: "md",
};

const CITY: Record<string, string> = {
  "san francisco": "us", "new york": "us", "new york city": "us", nyc: "us", "los angeles": "us", seattle: "us",
  "san jose": "us", "san diego": "us", boston: "us", chicago: "us", austin: "us", denver: "us", portland: "us",
  "palo alto": "us", "mountain view": "us", "silicon valley": "us", "bay area": "us", atlanta: "us", miami: "us",
  dallas: "us", houston: "us", washington: "us", "washington dc": "us", philadelphia: "us", pittsburgh: "us",
  phoenix: "us", "salt lake city": "us", nashville: "us", brooklyn: "us",
  london: "eng", manchester: "eng", cambridge: "eng", oxford: "eng", bristol: "eng",
  edinburgh: "sct", glasgow: "sct", cardiff: "wls", belfast: "nir",
  paris: "fr", lyon: "fr", berlin: "de", munich: "de", münchen: "de", muenchen: "de", hamburg: "de", frankfurt: "de",
  amsterdam: "nl", rotterdam: "nl", madrid: "es", barcelona: "es", rome: "it", milan: "it", milano: "it",
  toronto: "ca", vancouver: "ca", montreal: "ca", ottawa: "ca", waterloo: "ca",
  sydney: "au", melbourne: "au", tokyo: "jp", osaka: "jp", kyoto: "jp", beijing: "cn", shanghai: "cn",
  shenzhen: "cn", hangzhou: "cn", guangzhou: "cn", bangalore: "in", bengaluru: "in", mumbai: "in",
  "new delhi": "in", delhi: "in", hyderabad: "in", pune: "in", chennai: "in", "são paulo": "br", "sao paulo": "br",
  "rio de janeiro": "br", moscow: "ru", "saint petersburg": "ru", kyiv: "ua", kiev: "ua", lviv: "ua",
  warsaw: "pl", kraków: "pl", krakow: "pl", stockholm: "se", gothenburg: "se", oslo: "no", copenhagen: "dk",
  helsinki: "fi", zurich: "ch", zürich: "ch", geneva: "ch", vienna: "at", dublin: "ie", brussels: "be",
  lisbon: "pt", prague: "cz", budapest: "hu", bucharest: "ro", athens: "gr", istanbul: "tr", "tel aviv": "il",
  "buenos aires": "ar", "mexico city": "mx", seoul: "kr", taipei: "tw", "ho chi minh city": "vn", hanoi: "vn",
  bangkok: "th", jakarta: "id", manila: "ph", "kuala lumpur": "my", auckland: "nz", wellington: "nz",
  dubai: "ae", "abu dhabi": "ae", cairo: "eg", lagos: "ng", nairobi: "ke", bogotá: "co", bogota: "co", tbilisi: "ge",
};

const US_STATES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida",
  "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
  "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
  "virginia", "west virginia", "wisconsin", "wyoming",
]);

// Multiword keys checked as a phrase anywhere in the string (e.g. "based in united kingdom").
const MULTIWORD: [string, string][] = [...Object.entries(COUNTRY), ...Object.entries(CITY)].filter(([k]) =>
  k.includes(" "),
);

// "Georgia" is both a country (ge) and a US state. It reads as the US state only
// when another part of the location points at the US (a US alias, another state,
// or a US city); an unqualified "Georgia" is taken as the sovereign country.
function pointsToUS(segments: string[]): boolean {
  return segments.some((s) => s !== "georgia" && (COUNTRY[s] === "us" || US_STATES.has(s) || CITY[s] === "us"));
}

export function countryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const clean = location
    .toLowerCase()
    .replace(/[^\p{L}\s,./-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  const segments = clean.split(/[,/]/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    // "Georgia" is both the country (ge) and a US state. Read it as the country
    // only when nothing else points at the US; otherwise let it fall through to the
    // US_STATES check below, which flies the US flag (e.g. "Georgia, USA").
    if (seg === "georgia" && !pointsToUS(segments)) return "ge";
    if (COUNTRY[seg]) return COUNTRY[seg];
    if (US_STATES.has(seg)) return "us";
    if (CITY[seg]) return CITY[seg];
  }
  for (const [term, code] of MULTIWORD) {
    if (clean.includes(term)) return code;
  }
  return null;
}

// Pinned origin countries for the showcased accounts — their birthplace, not the
// city in their GitHub "location" (Torvalds lists Portland, but he's Finnish).
const PINNED: Record<string, string> = {
  torvalds: "us", // Linus Torvalds — Finland
  theprimeagen: "us", // Michael Paulson — USA
  "pewdiepie-archdaemon": "se",
  t3dotgg: "us", // Theo Browne — USA
};

// Country for a profile: a pinned origin (showcased accounts) wins, otherwise the
// best guess from the freeform GitHub location string.
export function countryForLogin(login: string, location: string | null | undefined): string | null {
  return PINNED[login.toLowerCase()] ?? countryFromLocation(location);
}
