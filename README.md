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

Developers can earn premium 3D trophies that display directly on their profile page and duel views. Clicking on any trophy opens an interactive modal to view details and qualifying statistics:

| Award | 3D Model | Qualification Criteria |
| :---: | :--- | :--- |
| **World Cup Trophy** | `/3D-Models/world_cup_trophy.glb` | **Generational Champion**: Earned by achieving an Overall rating of **85 or higher**, reflecting complete mastery. In duels, awarded to the overall match winner (or both in case of a draw). |
| **Golden Boot** | `/3D-Models/golden_boot.glb` | **Elite Star Attraction**: Earned by achieving a Shooting (`SHO`) stat of **80 or higher** (representing stellar repo star metrics). In duels, awarded to the player who wins the SHO category (or both in a tie). |
| **Golden Glove** | `/3D-Models/golden_glove.glb` | **Clean Sheet Defender**: Earned by achieving a Defending (`DEF`) stat of **60 or higher** (representing outstanding code reviews and issues closed). In duels, awarded to the player who wins the DEF category (or both in a tie). |

<br/>

<div align="center">

**Built with** Next.js · TypeScript · Tailwind · Redis

**[gitfut.com](https://gitfut.com)** &nbsp;·&nbsp; scout someone today

<img src="https://capsule-render.vercel.app/api?type=waving&height=90&color=0:39d353,100:006d32&section=footer" alt="" width="100%">

</div>
