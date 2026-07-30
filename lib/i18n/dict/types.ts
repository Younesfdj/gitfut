// Dictionary shape — single source for what `t()` can resolve. Using a precise
// `Dictionary` interface (rather than `Record<string, ...>`) lets editors and
// the `tests/i18n.test.ts` completeness check fail loudly when a key is added
// to en.ts but not ko.ts.
import type { Locale } from "../index";

export type Dict =
  | string
  | number
  | boolean
  | null
  | Dict[]
  | { [key: string]: Dict };

export interface ArchetypeDict {
  name: string;
  blurb: string;
}

export interface PlaystyleDict {
  name: string;
  noun: string;
  plusSuffix: string;
}

export interface StyleDict {
  value: string;
  reason: string;
}

export interface MetricDict {
  label: string;
  unit: string;
}

export interface StatDict {
  abbr: string;
  gloss: string;
}

export interface FinishDict {
  bronze: string;
  silver: string;
  gold: string;
  totw: string;
  toty: string;
  icon: string;
  founder: string;
}

export interface PositionDict {
  ST: string;
  RW: string;
  CAM: string;
  CM: string;
  CDM: string;
  CB: string;
}

export interface FamilyDict {
  Forward: string;
  Playmaker: string;
  Anchor: string;
}

/** Function-shape strings — interpolated at render time. */
// Type-only.
export type WorkRateReasonFn = (vars: { attack: string; defense: string }) => string;
export type ReasonWithVarsFn = (vars: Record<string, string | number>) => string;

export interface StatRowDict {
  pac: string;
  sho: string;
  pas: string;
  dri: string;
  def: string;
  phy: string;
}

export interface MetricReceiptsDict {
  commits: string;
  starsEarned: string;
  pullRequests: string;
  followers: string;
  codeReviews: string;
  contributions: string;
}

export interface DuelDict {
  title: string;
  vs: string;
  compare: string;
  winnerA: (vars: { a: string; stat: string }) => string;
  winnerB: (vars: { b: string; stat: string }) => string;
  tie: (vars: { stat: string }) => string;
  whistle: string;
  player1: string;
  player2: string;
  kicker: string;
  status: {
    kickoff: string;
    live: string;
    fullTime: string;
    afterPenalties: string;
    pensShort: string;
  };
  dominance: string;
  backHome: string;
  howWin: {
    penalties: (vars: { overall: number }) => string;
    scoreAcross: (vars: { scoreWinner: number; scoreLoser: number }) => string;
    cantNutmeg: string;
    drawCall: string;
  };
  drawHeadline: { training: string; match: string };
  skipHint: string;
  receiptsHeader: string;
  share: {
    shareDuel: string;
    shareX: string;
    copyLink: string;
    copied: string;
    rematchTitle: string;
    swapCorners: string;
    copyLinkTitle: string;
    copyLinkAria: string;
  };
  statRows: StatRowDict;
  metricReceipts: MetricReceiptsDict;
}

export interface ShareDict {
  scoutTitle: (vars: { login: string }) => string;
  tweetTemplate: (vars: { login: string; position: string; overall: number; url: string }) => string;
}
export interface UIDict {
  scoutForm: {
    headline: string;
    subhead: string;
    inputPlaceholder: string;
    inputAriaLabel: string;
    submit: string;
    submitting: string;
    tryPrefix: string;
    tryOrYourOwn: string;
    cardsRated: string;
    howItWorks: string;
  };
  howItWorks: {
    kicker: string;
    headlineTop: string;
    headlineMid: string;
    intro: string;
    laws: Array<{ kicker: string; lead: string; body: string; gold?: boolean }>;
    readsKicker: string;
    ladderKicker: string;
    ladder: Array<{ label: string; bg: string; ink: string }>;
    ladderFootnote: string;
    close: string;
  };
  cardActions: {
    share: string;
    copy: string;
    copied: string;
    openOriginal: string;
    download: string;
    storyExport: string;
  };
  duel: DuelDict;
  errors: {
    notFoundTitle: string;
    notFoundKicker: string;
    notFoundBody: string;
    errorKicker: string;
    errorTitle: string;
    errorBody: string;
    globalTitle: string;
    globalBody: string;
  };
  share: ShareDict;
  footer: {
    byline: string;
  };
  locale: {
    label: string;
    toggleTo: string;
    switchTo: string;
  };
  result: {
    back: string;
    backHome: string;
    shareOnX: string;
  };
}

export interface Dictionary {
  meta: {
    brand: string;
    tagline: string;
    description: string;
  };
  stats: Record<"pac" | "sho" | "pas" | "dri" | "def" | "phy", StatDict>;
  finish: FinishDict;
  position: PositionDict;
  family: FamilyDict;
  archetypes: {
    galactico: ArchetypeDict;
    poacher: ArchetypeDict;
    regista: ArchetypeDict;
    libero: ArchetypeDict;
    fantasista: ArchetypeDict;
    targetman: ArchetypeDict;
    mezzala: ArchetypeDict;
    founder: ArchetypeDict;
  };
  playstyles: Record<
    | "Star Magnet"
    | "Viral Hit"
    | "Workhorse"
    | "Rapid Fire"
    | "Marathoner"
    | "Maintainer"
    | "Connector"
    | "Magnetic"
    | "Polyglot"
    | "Prolific"
    | "Veteran",
    PlaystyleDict
  >;
  style: Record<
    "Explosive" | "Relentless" | "Controlled" | "Clinical" | "Industrious" | "Measured",
    StyleDict
  >;
  workRate: {
    label: { High: string; Med: string; Low: string };
    reason: WorkRateReasonFn;
  };
  attribute: {
    skillMoves: (count: number, langs: number, hasBonus: boolean, repos: string) => string;
    weakFoot: (weakAvg: number) => string;
  };
  metrics: Record<
    | "commits"
    | "starsEarned"
    | "topRepoReach"
    | "pullRequests"
    | "followers"
    | "languages"
    | "issues"
    | "codeReviews"
    | "contributions"
    | "accountAge"
    | "activeDays"
    | "repositories"
    | "activeYears",
    MetricDict
  >;
  ui: UIDict;
  puns: readonly string[];
  /** Localized country names keyed by ISO alpha-2 (lowercase). UK_NATIONS
      3-letter codes (eng/sct/wls/nir) included alongside. Lookup helper:
      `t.countryName(code, locale)` falls back to the EN string when missing
      in the requested locale. */
  countries: Record<string, string>;
  numbers: Record<string, never>;
}

/** Convenience for translators: the static structure should match en.ts exactly. */
export type AssertSameShape<T extends Dictionary> = T;
