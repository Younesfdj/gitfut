<div align="center">

<img src="public/mascot.webp" width="120" alt="GitFut mascot">

# GitFut

**your GitHub, rated out of 99** ⚽

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=2600&pause=800&color=39D353&center=true&vCenter=true&width=660&height=42&lines=Turn+any+GitHub+profile+into+a+FIFA-style+card;Scored+live+from+real+commits%2C+stars+%26+PRs;Embed+it+anywhere+%E2%80%94+it+updates+itself" alt="Turn any GitHub profile into a player card, scored live, embeddable anywhere">

<br/><br/>

<a href="https://gitfut.com/torvalds"><img src="https://gitfut.com/torvalds.png" width="240" alt="GitFut card"></a>
<a href="https://gitfut.com/ThePrimeagen"><img src="https://gitfut.com/ThePrimeagen.png" width="240" alt="GitFut card"></a>
<a href="https://gitfut.com/t3dotgg"><img src="https://gitfut.com/t3dotgg.png" width="240" alt="GitFut card"></a>

<br/><br/>

</div>

<br/>

## 🃏 &nbsp;Embed your card

Your card lives at a URL. Drop it in your profile README, your portfolio, anywhere — and it **re-scouts itself** as your stats change.

```md
[![My GitFut card](https://gitfut.com/YOUR_USERNAME.png)](https://gitfut.com/YOUR_USERNAME)
```

| | |
|---|---|
| **`gitfut.com/<username>.png`** | your card, as a live image |
| **`gitfut.com/<username>`** | the full scout report |
| **`?country=XX`** | override the flag (e.g. `?country=DZ`) |

<br/>

## ⚙️ &nbsp;How the scouting works

Six signals from a live GitHub profile, each mapped to a football stat — read straight from GitHub's GraphQL API. No surveys, no self-reporting. Just the commits.

| | Stat | Scouted from |
|:--:|:--|:--|
| **PAC** | Pace | Commits in the last year |
| **SHO** | Shooting | Stars earned across repos |
| **PAS** | Passing | Pull requests + followers |
| **DRI** | Dribbling | Language diversity |
| **DEF** | Defending | Reviews + issues |
| **PHY** | Physical | Lifetime contributions |

Your **overall** is the headline. Raw stats cap at **88** — the 90s are a legacy gate, earned with years and influence, so one heroic year won't crown you an Icon. Your **position** and **archetype** are read from your stat shape: a shooting spike scouts a poacher up top, a defending-and-passing lean scouts a deep playmaker.

Every card walks out in a finish:

<div align="center">

![Bronze](https://img.shields.io/badge/BRONZE-%E2%89%A464-CD7F32?style=flat-square&labelColor=2A1A0C)
![Silver](https://img.shields.io/badge/SILVER-65--74-AAB2BD?style=flat-square&labelColor=262B33)
![Gold](https://img.shields.io/badge/GOLD-75--84-E6B422?style=flat-square&labelColor=3A2806)
![In-Form](https://img.shields.io/badge/IN--FORM-spike-E03E52?style=flat-square&labelColor=4A0A14)
![TOTY](https://img.shields.io/badge/TOTY-85--89-3B7AFF?style=flat-square&labelColor=10254F)
![Icon](https://img.shields.io/badge/ICON-90%2B-F3D688?style=flat-square&labelColor=2A1A45)

</div>

<br/>

## 🏆 &nbsp;Achievements & Awards

Standout cards earn trophies, shown on the scout report and carried into duels like a boxer's belts — a duel showcases what each player brings, it never awards anything itself. Click a trophy for its story: every win is attached to a year (or a World Cup edition) with the reason it was given. Rendered from pre-baked rotating sprites (no 3D runtime — see `scripts/bake-award-sprites.ts`):

| Award | Won for |
| :---: | :--- |
| **Ballon d'Or** | A calendar year that towers over the rest of your career — judged against your own history (log-scaled across commits, PRs, reviews and issues, so volume spam can't buy it). Repeatable, but every extra one is harder to win: up to 3, and Icons can take a 4th. |
| **WC Golden Ball** | Best player of a World Cup — rising above your own pace while a tournament ran (2010 → 2026, era-adjusted: shipping on GitHub in 2010 already counted). One per edition. |
| **Golden Boot** | The top scorer, held on current form — elite Shooting (`SHO` 80+) from a scoring position (`ST`/`RW`/`CAM`). |
| **World Cup Trophy** | ¡Campeones! Spain won WC26 — a gift carried by every profile whose GitHub location is Spain. |

### The rulebook

Every scout fetches the profile's full history as per-year totals: commits, PRs, reviews, issues and private contributions, for every calendar year since the account was born. Yearly awards are judged on one score per year:

```
yearScore = 4·log(commits) + 3·log(PRs) + 3·log(reviews) + 2·log(issues) + 2·log(private)
```

The logs are the anti-spam mechanism. Each signal saturates: 20,000 commits score 17.2, barely ahead of the 13.2 that 2,000 earn. Meanwhile a year of 800 commits, 80 PRs, 80 reviews and 40 issues scores 26. Breadth collects from every term while volume on one axis stalls. There is no balance requirement, though: a commits-only kernel maintainer still scores on the volume terms alone.

Every trophy except the Spanish gift also requires **overall 80+**. That's a floor, not a driver. It keeps thin profiles off the podium and decides nothing else.

#### Ballon d'Or

Judged against your own career, so it needs at least two years of history. A year wins when it clears all three:

1. **2,000+ raw contributions.** No Ballon d'Or on a quiet year, however spiky it looks against the rest.
2. **Score 16+.** Strong in absolute terms, not just relative ones.
3. **One of two paths:**
   - *The spike*: 1.2× your career-median year. One undeniable season in a modest career.
   - *The elite*: score 19.5+, ratio waived. A sustained-great career has a huge median no single year can tower over, and those years are exactly what the award exists for.

Repeats climb a ladder on the card's overall: **80** holds one, **87** unlocks a second, **94** a third. Icons can take a fourth, and only for a monster year (score 28+). The current year competes while still in progress. It can only under-score, never over-score, so nothing is ever awarded on a projection.

#### WC Golden Ball

One per World Cup edition. For candidates (overall 80+, activity in a WC year) the scout fetches contributions inside each tournament window and judges them era-adjusted, because GitHub in 2010 was a different sport:

| Edition | Window | The bar |
| :-- | :-- | :-- |
| South Africa 2010 | Jun 11 – Jul 11 | Presence. Shipping on GitHub at all was the distinction. |
| Brazil 2014 | Jun 12 – Jul 13 | A handful of contributions. |
| Russia 2018 | Jun 14 – Jul 15 | A real window, at **1.2×** your usual pace. |
| Qatar 2022 | Nov 20 – Dec 18 | A strong window (~10 contributions/day), at **1.3×** your usual pace. |
| North America 2026 | Jun 11 – Jul 19 | A strong window (~10 contributions/day), at **1.3×** your usual pace. |

The pace test compares your daily rate inside the window to your daily rate across that same year. Tournament form means rising above *your own* pace, not an absolute quota. The current year is paced over its elapsed days, not 365, so a routine mid-year can't masquerade as tournament form against a diluted average.

#### Golden Boot

The one trophy held on current form, not kept for life. No year attached, re-judged on every scout: a scoring position (`ST`/`RW`/`CAM`) and Shooting 80+. Star power *is* the shooting stat, so this is the finisher whose repos keep hitting the net. Lose the form, lose the boot.

#### World Cup Trophy

Spain won WC26, and every profile whose GitHub location reads Spain lifts the trophy with them: bronze cards included, no floors, no other conditions. It keys off the country GitHub reports, decided before the flag picker exists, so switching your flag to 🇪🇸 mints nothing.

The whole cabinet is computed server-side at scout time and cached with the card. Duels never award anything. A corner showcases what each card walked in with.

<br/>

<div align="center">

**Built with** Next.js · TypeScript · Tailwind · Redis

**[gitfut.com](https://gitfut.com)** &nbsp;·&nbsp; scout someone today

<img src="https://capsule-render.vercel.app/api?type=waving&height=90&color=0:39d353,100:006d32&section=footer" alt="" width="100%">

</div>
