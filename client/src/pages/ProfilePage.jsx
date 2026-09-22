import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatNumber } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import {
  heroImg,
  heroWidgetImg,
  heroWidgetFallbacks,
  govGearImg,
  asset,
} from '../utils/images';

/* Exact class map from Hero.json */
const HERO_CLASS = {
  Edwin: 'Cavalry',
  Forrest: 'Infantry',
  Olive: 'Archer',
  Seth: 'Infantry',
  Amane: 'Archer',
  Chenko: 'Cavalry',
  Diana: 'Archer',
  Fahd: 'Cavalry',
  Gordon: 'Cavalry',
  Howard: 'Infantry',
  Quinn: 'Archer',
  Yeonwoo: 'Archer',
  Amadeus: 'Infantry',
  Helga: 'Infantry',
  Jabel: 'Cavalry',
  Saul: 'Archer',
  Hilde: 'Cavalry',
  Marlin: 'Archer',
  Zoe: 'Infantry',
  Eric: 'Infantry',
  Jaeger: 'Archer',
  Petra: 'Cavalry',
  Alcar: 'Infantry',
  Margot: 'Cavalry',
  Rosa: 'Archer',
  'Long Fei': 'Infantry',
  Thrud: 'Cavalry',
  Vivian: 'Archer',
  Sophia: 'Cavalry',
  Triton: 'Infantry',
  Yang: 'Archer',
  Ava: 'Cavalry',
  Charles: 'Infantry',
  'Wee & Woo': 'Archer',
};

/* Same petal system as HeroesPage */
const FLOWERS_CONFIG = [
  { id: 0, values: ['0.1', '0.2', '0.3', '0.4', '0.5', '1.0'] },
  { id: 1, values: ['1.1', '1.2', '1.3', '1.4', '1.5', '2.0'] },
  { id: 2, values: ['2.1', '2.2', '2.3', '2.4', '2.5', '3.0'] },
  { id: 3, values: ['3.1', '3.2', '3.3', '3.4', '3.5', '4.0'] },
  { id: 4, values: ['4.1', '4.2', '4.3', '4.4', '4.5', '5.0'] },
];
const PETAL_PATH = 'M 75,24 L 87.5,51.5 L 75,73 L 62.5,51.5 Z';
const PETAL_ANGLES = [0, -60, -120, -180, -240, -300];

const SLOT_ALIASES = {
  weapon: 'weapon',
  helm: 'helm',
  helmet: 'helm',
  head: 'helm',
  gloves: 'gloves',
  glove: 'gloves',
  hands: 'gloves',
  hand: 'gloves',
  chest: 'chest',
  armor: 'chest',
  body: 'chest',
  boots: 'boots',
  boot: 'boots',
  feet: 'boots',
  shoes: 'boots',
};

function fmt(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return formatNumber(num);
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

/** Map API star fields → absolute petal index (0…29), or -1 */
/** Map "4.2" / "4-Star (Tier 2)" → absolute petal index (0…29) */
function petalLabelToAbs(label) {
  const asStr = String(label).trim();
  for (let fi = 0; fi < FLOWERS_CONFIG.length; fi++) {
    const vals = FLOWERS_CONFIG[fi].values;
    for (let pi = 0; pi < vals.length; pi++) {
      if (vals[pi] === asStr || Number(vals[pi]) === Number(asStr)) {
        let abs = 0;
        for (let j = 0; j < fi; j++) abs += FLOWERS_CONFIG[j].values.length;
        return abs + pi;
      }
    }
  }
  return -1;
}

/**
 * MightPulse: "4-Star (Tier 2)" means star level 4.2
 * → full flowers through 4.0, plus 2 petals on the next flower.
 */
function starToAbsIdx(hero) {
  if (!hero) return -1;

  const labelCandidates = [
    hero.star_label,
    hero.stars_label,
    hero.starLabel,
    hero.star_display,
    hero.stars_display,
  ];

  for (const raw of labelCandidates) {
    if (raw == null || raw === '') continue;
    const asStr = String(raw).trim();

    // Direct petal label
    let abs = petalLabelToAbs(asStr);
    if (abs >= 0) return abs;

    // "4-Star (Tier 2)" → 4.2 ; "5-Star" → 5.0 ; "3-Star (Tier 5)" → 3.5
    const m = asStr.match(/(\d+)\s*[- ]?\s*star(?:\s*\(\s*tier\s*(\d+)\s*\))?/i);
    if (m) {
      const whole = Math.min(5, Math.max(0, Number(m[1])));
      const tier = m[2] != null ? Math.min(5, Math.max(0, Number(m[2]))) : 0;
      const petal = tier > 0 ? `${whole}.${tier}` : `${whole}.0`;
      abs = petalLabelToAbs(petal);
      if (abs >= 0) return abs;
      // whole 0 with tier → 0.T
      if (whole === 0 && tier > 0) {
        abs = petalLabelToAbs(`0.${tier}`);
        if (abs >= 0) return abs;
      }
    }
  }

  // Separate numeric fields: stars=4, star_tier=2 → 4.2
  const wholeRaw = hero.star ?? hero.stars ?? hero.star_level;
  const tierRaw = hero.star_tier ?? hero.tier ?? hero.starTier;
  if (wholeRaw != null && wholeRaw !== '') {
    const whole = Number(wholeRaw);
    if (Number.isFinite(whole)) {
      // already decimal 4.2
      if (!Number.isInteger(whole) && whole > 0 && whole <= 5) {
        const abs = petalLabelToAbs(String(whole));
        if (abs >= 0) return abs;
      }
      const tierNum = Number(tierRaw);
      const tier = Number.isFinite(tierNum) && tierNum > 0 ? Math.min(5, Math.floor(tierNum)) : 0;
      const petal = tier > 0 ? `${Math.floor(whole)}.${tier}` : `${Math.floor(whole)}.0`;
      const abs = petalLabelToAbs(petal);
      if (abs >= 0) return abs;
    }
  }

  if (tierRaw != null && wholeRaw == null) {
    // unlikely alone
  }
  return -1;
}

/** Read-only petals — same SVG design as Heroes page (no text label) */
function StarPetals({ maxIdx }) {
  if (maxIdx < 0) {
    return <span className="ah-star-unknown">—</span>;
  }
  let remaining = maxIdx + 1;
  return (
    <div className="flowers-container ah-flowers" data-type="profile">
      {FLOWERS_CONFIG.map((flowerData, flowerIdx) => {
        const flowerLength = flowerData.values.length;
        let activeLimit = -1;
        if (remaining >= flowerLength) {
          activeLimit = flowerLength - 1;
          remaining -= flowerLength;
        } else if (remaining > 0) {
          activeLimit = remaining - 1;
          remaining = 0;
        }
        return (
          <div className="flower-wrapper" key={flowerData.id}>
            <svg viewBox="0 0 150 150" className="flower-svg">
              {flowerData.values.map((val, i) => (
                <path
                  key={val}
                  className={`petal${i <= activeLimit ? ' selected' : ''}`}
                  style={{
                    '--rotate': `${PETAL_ANGLES[i]}deg`,
                    transformOrigin: '75px 75px',
                    cursor: 'default',
                  }}
                  d={PETAL_PATH}
                />
              ))}
              <circle className="center-core" cx="75" cy="75" r="4" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** troop: 1 infantry, 2 cavalry, 3 archer (MightPulse) */
const TROOP_CODE = { 1: 'infantry', 2: 'cavalry', 3: 'archer' };

function resolveHeroClass(hero, name, gearItem) {
  const fromGear = (
    gearItem?.troop_label ||
    gearItem?.troop ||
    gearItem?.class ||
    ''
  )
    .toString()
    .trim();
  const fromApi = (
    hero?.class ||
    hero?.troop_type ||
    hero?.troopType ||
    hero?.unit_type ||
    hero?.type ||
    ''
  )
    .toString()
    .trim();
  for (const src of [fromGear, fromApi]) {
    if (/^\d+$/.test(src) && TROOP_CODE[Number(src)]) return TROOP_CODE[Number(src)];
    if (/infantry/i.test(src)) return 'infantry';
    if (/cavalry/i.test(src)) return 'cavalry';
    if (/archer|ranged|bow/i.test(src)) return 'archer';
  }
  const mapped = HERO_CLASS[name];
  return mapped ? mapped.toLowerCase() : 'infantry';
}

/**
 * Quality file suffix: mythic | red | epic
 * quality_key "mythic" / quality 5 → mythic
 */
function resolveQualityFile(item) {
  if (item?.red === true || item?.is_red === true) return 'red';
  const enh = Number(item?.enhancement_level ?? item?.slv ?? item?.gear_level);
  if (Number.isFinite(enh) && enh >= 101) return 'red';

  // Prefer quality_key first (exact: mythic | epic | …)
  const key = String(item?.quality_key || '').toLowerCase().trim();
  if (key === 'mythic' || key === 'gold' || key === 'orange') return 'mythic';
  if (key === 'red' || key === 'legendary') return 'red';
  if (key === 'epic' || key === 'purple') return 'epic';

  const q = String(
    item?.quality_label || item?.quality || item?.color || item?.rarity || item?.grade || ''
  ).toLowerCase();

  if (q.includes('red') || q.includes('legendary')) return 'red';
  if (
    q.includes('mythic') ||
    q.includes('gold') ||
    q.includes('orange') ||
    q.includes('yellow')
  ) {
    return 'mythic';
  }
  // numeric quality 5 = mythic, 4 often gold/mythic, 3 epic
  const n = Number(item?.quality);
  if (n === 5 || n === 4) return 'mythic';
  if (n === 3) return 'epic';
  if (q.includes('epic') || q.includes('purple') || q === '3') return 'epic';
  if (q.includes('rare') || q.includes('blue')) return 'epic';
  return 'mythic';
}

function slotFile(slot) {
  const k = String(slot || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return SLOT_ALIASES[k] || k || 'helm';
}

/** Absolute URL for relative gear icon paths */
function absGearIcon(icon) {
  if (!icon) return null;
  const s = String(icon).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://mightpulse.com${s}`;
  return `https://mightpulse.com/${s.replace(/^\/+/, '')}`;
}

/**
 * Local assets under /assets/hero_gear/{class}-{slot}-{quality}.webp
 * Note: cavalry-chest-mythic.webp is missing in the repo (only epic exists) —
 * prefer API icon, then same quality on other classes, then generic mythic —
 * never jump straight to epic when quality is mythic.
 */
function heroGearSrc(hero, heroName, item) {
  const cls = resolveHeroClass(hero, heroName, item);
  const slot = slotFile(item?.slot || item?.type || item?.name || item?.part);
  const quality = resolveQualityFile(item);
  const apiIcon = absGearIcon(item?.icon || item?.image || item?.img);

  if (slot === 'weapon') {
    const gen = quality === 'red' ? 'hero-gear-red.webp' : 'hero-gear-mythic.webp';
    return {
      src: apiIcon || asset(gen),
      fallbacks: [asset(gen), asset('hero-gear-mythic.webp'), asset('mythic-gear.webp')].filter(Boolean),
    };
  }

  const pathFor = (c, q) => asset(`hero_gear/${c}-${slot}-${q}.webp`);
  const classes = [cls, 'infantry', 'cavalry', 'archer'].filter(
    (c, i, a) => a.indexOf(c) === i
  );

  // Same quality across classes first (fixes missing cavalry-chest-mythic → use infantry/archer mythic)
  const sameQuality = classes.map((c) => pathFor(c, quality));
  // Then generic quality art
  const generic =
    quality === 'red'
      ? [asset('hero-gear-red.webp'), asset('hero-gear-mythic.webp')]
      : quality === 'mythic'
        ? [asset('hero-gear-mythic.webp'), asset('mythic-gear.webp')]
        : [asset('hero-gear-mythic.webp')];

  // Only after same-quality options, try other qualities for same class
  const otherQ =
    quality === 'mythic'
      ? ['red'] // still better than epic for a mythic piece
      : quality === 'red'
        ? ['mythic']
        : ['mythic', 'red'];
  const otherQuality = otherQ.flatMap((q) => classes.map((c) => pathFor(c, q)));

  // Epic last as absolute last resort
  const epicLast = classes.map((c) => pathFor(c, 'epic'));

  const primary = apiIcon || pathFor(cls, quality);
  const fallbacks = [
    pathFor(cls, quality),
    apiIcon,
    ...sameQuality,
    ...generic,
    ...otherQuality,
    ...epicLast,
  ].filter(Boolean);

  // de-dupe while preserving order
  const seen = new Set();
  const uniq = [];
  for (const u of [primary, ...fallbacks]) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    uniq.push(u);
  }
  return { src: uniq[0], fallbacks: uniq.slice(1) };
}

/** Enhancement badge color by level range */
/**
 * Enhancement (+N) badge colors.
 * Below +101: no background, black text.
 */
function enhanceClass(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 200) return 'enh-red';
  if (n >= 180) return 'enh-orange';
  if (n >= 160) return 'enh-purple';
  if (n >= 140) return 'enh-blue';
  if (n >= 129) return 'enh-green';
  if (n >= 101) return 'enh-grey';
  return 'enh-plain'; // 1–100: white background
}

/**
 * API gear fields (MightPulse):
 *   gear_level / slv  → enhancement (+N) top-right badge
 *   refine_level / rlv → Lv. under the image
 */
function GearTile({ hero, heroName, item }) {
  const { src, fallbacks } = heroGearSrc(hero, heroName, item);

  // Under image: refine level only
  const refine =
    item?.refine_level ??
    item?.refineLevel ??
    item?.rlv ??
    item?.sublabel?.toString?.().match?.(/(\d+)/)?.[1] ??
    0;

  // Top-right: enhancement (+N) — gear_level / slv / enhancement_level
  const enh =
    item?.enhancement_level ??
    item?.enhancementLevel ??
    item?.slv ??
    item?.gear_level ??
    item?.gearLevel ??
    item?.plus ??
    null;

  const refineNum = Number(refine);
  const enhNum = Number(enh);
  const hasEnh = enh != null && Number.isFinite(enhNum) && enhNum > 0;
  const enhCss = hasEnh ? enhanceClass(enhNum) : null;

  return (
    <div className="ah-gear-tile">
      {enhCss && (
        <span className={`ah-gear-plus ${enhCss}`}>+{enhNum}</span>
      )}
      <AssetImg
        src={src}
        fallbacks={fallbacks || []}
        size={56}
        alt={item?.slot || item?.name || 'gear'}
        className="ah-gear-img"
      />
      <span className="ah-gear-lv">
        Lv. {Number.isFinite(refineNum) ? refineNum : refine}
      </span>
    </div>
  );
}

/** Widget tile — same visual style as gear, level under image */
function WidgetTile({ heroName, hero }) {
  const widgetLv =
    hero?.exclusive_gear?.level ??
    hero?.exclusive_gear_level ??
    hero?.widget_level ??
    hero?.widgetLevel ??
    0;
  const lv = Number(widgetLv);
  return (
    <div className="ah-gear-tile ah-widget-tile">
      <AssetImg
        src={heroWidgetImg(heroName)}
        fallbacks={heroWidgetFallbacks(heroName)}
        size={56}
        alt="widget"
        className="ah-gear-img"
      />
      <span className="ah-gear-lv">
        Lv. {Number.isFinite(lv) ? lv : widgetLv || 0}
      </span>
    </div>
  );
}

function ArenaHeroCard({ hero, index }) {
  const name = (hero?.name || hero?.hero_name || 'Hero').trim();
  const absIdx = starToAbsIdx(hero);
  const level = hero?.level ?? hero?.hero_level ?? '—';
  const widgetLv =
    hero?.exclusive_gear?.level ??
    hero?.exclusive_gear_level ??
    hero?.widget_level ??
    hero?.widgetLevel ??
    '—';
  const slot = hero?.slot ?? hero?.position ?? hero?.arena_slot ?? index + 1;
  const gear = Array.isArray(hero?.gear)
    ? hero.gear
    : Array.isArray(hero?.equipment)
      ? hero.equipment
      : [];
  const heroClass = resolveHeroClass(hero, name);
  const hasWidget =
    !!hero?.exclusive_gear ||
    !!hero?.widget_name ||
    hero?.exclusive_gear_level != null ||
    hero?.widget_level != null;

  return (
    <article className="ah-card">
      <div className="ah-top">
        <AssetImg
          src={heroImg(name)}
          fallbacks={[asset(`heroes/${name.toLowerCase().replace(/ /g, '_')}.webp`)]}
          size={56}
          alt={name}
          className="ah-portrait"
        />
        <div className="ah-top-main">
          <div className="ah-name">
            {name}
            <span className="ah-class-tag">{heroClass}</span>
          </div>
          <StarPetals maxIdx={absIdx} />
        </div>
      </div>

      <div className="ah-stats">
        <div className="ah-stat-row">
          <span>Hero Lv</span>
          <strong>{level}</strong>
        </div>
        <div className="ah-stat-row">
          <span>Widget Level</span>
          <strong>{widgetLv === '' || widgetLv == null ? '—' : widgetLv}</strong>
        </div>
        <div className="ah-stat-row">
          <span>Slot</span>
          <strong>{slot}</strong>
        </div>
      </div>

      <div className="ah-gear-label">GEAR</div>
      {gear.length === 0 && !hasWidget ? (
        <p className="hint ah-gear-empty">No gear data</p>
      ) : (
        <div className="ah-gear-grid">
          {hasWidget && <WidgetTile heroName={name} hero={hero} />}
          {gear.map((g, i) => (
            <GearTile key={g.slot || g.name || g.eid || i} hero={hero} heroName={name} item={g} />
          ))}
        </div>
      )}
    </article>
  );
}


/** Build local gov gear path from API quality / tier / star */
function govGearFromItem(item) {
  const slot = item?.slot || item?.name || 'Helmet';
  const q = String(item?.quality || item?.quality_label || item?.quality_key || '').toLowerCase();
  let color = 'green';
  if (q.includes('red')) color = 'red';
  else if (q.includes('gold') || q.includes('orange') || q.includes('yellow')) color = 'gold';
  else if (q.includes('purple')) color = 'purple';
  else if (q.includes('blue')) color = 'blue';
  else if (q.includes('green')) color = 'green';
  const tier = item?.tier != null ? String(item.tier) : '0';
  const starCount = Number(item?.star);
  const stars = Number.isFinite(starCount) ? Math.max(0, Math.min(3, starCount)) : 0;
  // Match govGearImg expected label style
  const levelName = `${color} T${tier}${'⭐'.repeat(stars)}`;
  const local = govGearImg(slot, levelName);
  const apiIcon = item?.icon || null;
  return {
    src: apiIcon || local,
    fallbacks: [local, govGearImg(slot, color), asset('mythic-gear.webp')].filter(Boolean),
  };
}

function Section({ title, children, empty }) {
  return (
    <section className="mp-section">
      <h3 className="mp-section-title">{title}</h3>
      {empty ? <p className="hint mp-empty">No data available</p> : children}
    </section>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`mp-stat ${highlight ? 'mp-stat-hi' : ''}`}>
      <span className="mp-stat-val">{value}</span>
      <span className="mp-stat-lbl">{label}</span>
    </div>
  );
}


/**
 * Town Center display:
 * Prefer real tg_info.short / label / tg_level when present.
 * If tg_info is missing or "—", convert town_center_level:
 *   1–30 raw; 31–34 TG0-x; 35+ TG blocks of 5 (55 → TG5, 80 → TG10)
 */
function readTgInfo(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const tg = source.tg_info || source.tgInfo;
    if (tg && typeof tg === 'object') return tg;
  }
  return null;
}

function isBlankTg(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return !s || s === '—' || s === '-' || s === '–' || s.toLowerCase() === 'null';
}

/**
 * TC → TG display (game rules):
 *   1–30  → raw level
 *   31–34 → TG0-1 … TG0-4
 *   35    → TG1
 *   36–39 → TG1-1 … TG1-4
 *   40    → TG2
 *   … every +5 major TG …
 *   55    → TG5
 *   80    → TG10
 */
function levelToTgLabel(lv) {
  const n = Math.floor(Number(lv));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 30) return String(n);
  if (n <= 34) return `TG0-${n - 30}`;
  // n >= 35: blocks of 5 → TG1, TG1-1..TG1-4, TG2, ...
  const offset = n - 35;
  const major = Math.floor(offset / 5) + 1;
  const sub = offset % 5;
  if (sub === 0) return `TG${major}`;
  return `TG${major}-${sub}`;
}

function readTownLevel(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const lv =
      source.town_center_level ??
      source.stove_lv ??
      source.stoveLv ??
      source.townCenterLevel;
    if (lv != null && lv !== '') return lv;
    // ranks payload sometimes nests under leaderboards only — also check raw
  }
  return null;
}

function tgShort(...sources) {
  const tg = readTgInfo(...sources);
  if (tg) {
    if (!isBlankTg(tg.short)) return String(tg.short).trim();
    if (!isBlankTg(tg.label)) return String(tg.label).replace(/\s+/g, '');
    if (tg.is_tg && tg.tg_level != null && !isBlankTg(tg.tg_level)) {
      return `TG${tg.tg_level}`;
    }
    // tg_info present but empty — fall through to level conversion
    if (tg.stove_lv != null && !isBlankTg(tg.stove_lv)) {
      return levelToTgLabel(tg.stove_lv);
    }
  }
  const lv = readTownLevel(...sources);
  return levelToTgLabel(lv);
}

/** Full number with commas — never K/M */
function fmtFull(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatRankLabel(boardOrRank, fallbackRank) {
  if (boardOrRank && typeof boardOrRank === 'object') {
    if (boardOrRank.kingdom_rank_label != null && boardOrRank.kingdom_rank_label !== '') {
      return String(boardOrRank.kingdom_rank_label);
    }
    if (boardOrRank.kingdom_rank != null && boardOrRank.kingdom_rank !== '') {
      const n = Number(boardOrRank.kingdom_rank);
      return Number.isFinite(n) ? `#${n}` : String(boardOrRank.kingdom_rank);
    }
  }
  if (fallbackRank == null || fallbackRank === '') return '—';
  const s = String(fallbackRank);
  if (s.includes('+') || s.startsWith('#')) return s;
  const n = Number(fallbackRank);
  if (Number.isFinite(n)) return `#${n}`;
  return s;
}

/**
 * Fixed core ranks + 6 trail boards only (no duplicate "remaining" pass).
 * Trail boards use value_label + kingdom_rank_label from API.
 */
function buildKingdomRankRows(ranks, player) {
  if (!ranks) return [];

  const boards = Array.isArray(ranks.leaderboards) ? ranks.leaderboards : [];
  const findBoard = (...names) => {
    const lower = names.map((n) => n.toLowerCase());
    return boards.find((b) => {
      const n = String(b.name || b.label || b.key || '').toLowerCase();
      return lower.some((x) => n === x || n.includes(x));
    });
  };

  const rows = [
    {
      key: 'power',
      label: 'Personal Power',
      rank: formatRankLabel(null, ranks.power_rank),
      value: fmtFull(ranks.power),
    },
    {
      key: 'kills',
      label: 'Kill Count',
      rank: formatRankLabel(null, ranks.kills_rank),
      value: fmtFull(ranks.kills),
    },
    {
      key: 'tc',
      label: 'Town Center Level',
      rank: formatRankLabel(null, ranks.town_center_rank),
      value: tgShort(ranks, player) || fmtFull(ranks.town_center_level),
    },
    {
      key: 'migrant',
      label: 'Migrant Score',
      rank: formatRankLabel(null, ranks.migrant_rank),
      value: fmtFull(ranks.migrant_score),
    },
    {
      key: 'mystic',
      label: 'Mystic Trial',
      rank: formatRankLabel(null, ranks.mystic_rank),
      value: fmtFull(ranks.mystic_trial),
    },
  ];

  // rank_type 21–26 or name match
  const trail = [
    { key: 'coliseum', label: 'Coliseum', names: ['coliseum', 'colosseum'], type: 21 },
    { key: 'forest', label: 'Forest of Life', names: ['forest of life'], type: 22 },
    { key: 'crystal', label: 'Crystal Cave', names: ['crystal cave'], type: 23 },
    { key: 'knowledge', label: 'Knowledge Nexus', names: ['knowledge nexus'], type: 24 },
    { key: 'molten', label: 'Molten Fort', names: ['molten fort'], type: 25 },
    { key: 'radiant', label: 'Radiant Spire', names: ['radiant spire'], type: 26 },
  ];

  for (const t of trail) {
    const b =
      boards.find((x) => Number(x.rank_type) === t.type) || findBoard(...t.names);
    if (!b) continue;
    rows.push({
      key: t.key,
      label: b.name || t.label,
      rank: formatRankLabel(b),
      // Prefer value_label ("32-1") over raw numeric value
      value:
        b.value_label != null && b.value_label !== ''
          ? String(b.value_label)
          : fmtFull(b.value),
    });
  }

  return rows;
}

export default function ProfilePage() {
  const { user, setAuthOpen, setAuthMode, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [cooldownTotal, setCooldownTotal] = useState(600);
  const timerRef = useRef(null);
  const cooldownEndRef = useRef(0);

  const syncCooldownFromStatus = useCallback(async () => {
    if (!user?.gameId) {
      setCooldownLeft(0);
      return;
    }
    try {
      const st = await api.get('/player/refresh-status');
      const rem = Number(st.cooldown_remaining_sec) || 0;
      const total = Number(st.cooldown_total_sec) || 600;
      setCooldownTotal(total);
      cooldownEndRef.current = Date.now() + rem * 1000;
      setCooldownLeft(Math.max(0, Math.ceil(rem)));
    } catch {
      /* status optional on first paint */
    }
  }, [user?.gameId]);

  useEffect(() => {
    const tick = () => {
      const leftMs = cooldownEndRef.current - Date.now();
      setCooldownLeft(Math.max(0, Math.ceil(leftMs / 1000)));
    };
    tick();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadPlayer = useCallback(async () => {
    if (!user?.gameId) {
      setPayload(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/player?include=base,heroes,ranks');
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(err?.message || 'Failed to load player');
    } finally {
      setLoading(false);
    }
  }, [user?.gameId]);

  const refreshPlayer = useCallback(async () => {
    if (!user?.gameId || refreshing) return;
    if (cooldownLeft > 0) return;
    setRefreshing(true);
    setError('');
    try {
      const data = await api.post('/player/refresh', {});
      setPayload(data);
      const rem = Number(data?.refresh?.cooldown_remaining_sec);
      if (Number.isFinite(rem) && rem > 0) {
        cooldownEndRef.current = Date.now() + rem * 1000;
        setCooldownLeft(Math.ceil(rem));
        setCooldownTotal(Number(data?.refresh?.cooldown_total_sec) || 600);
      } else {
        // After successful refresh, site cooldown is typically 600s
        cooldownEndRef.current = Date.now() + 600 * 1000;
        setCooldownLeft(600);
        setCooldownTotal(600);
      }
      await syncCooldownFromStatus();
    } catch (err) {
      const rem = Number(err?.data?.cooldown_remaining_sec);
      if (err?.status === 429 || err?.data?.error === 'cooldown') {
        const sec = Number.isFinite(rem) ? rem : 0;
        cooldownEndRef.current = Date.now() + sec * 1000;
        setCooldownLeft(Math.max(0, Math.ceil(sec)));
        setCooldownTotal(Number(err?.data?.cooldown_total_sec) || 600);
        setError(err?.data?.detail || 'Refresh is on cooldown');
      } else {
        setError(err?.message || 'Refresh failed');
      }
    } finally {
      setRefreshing(false);
    }
  }, [user?.gameId, refreshing, cooldownLeft, syncCooldownFromStatus]);

  useEffect(() => {
    loadPlayer();
    syncCooldownFromStatus();
  }, [loadPlayer, syncCooldownFromStatus]);

  const player = payload?.player || {};
  const alliance = player.alliance || null;
  const heroes = useMemo(
    () => (Array.isArray(payload?.heroes) ? payload.heroes : []),
    [payload]
  );
  const ranks = payload?.ranks || null;

  // Always: https://got-global-avatar.akamaized.net/avatar/{YYYY/MM/DD/file.png}
  // Strip any /cdn or /avatar prefix from upstream fields.
  const avatarUrl = (() => {
    const BASE = 'https://got-global-avatar.akamaized.net/avatar';
    const candidates = [
      player.avatar_url,
      player.avatarUrl,
      player.upload_image,
      player.uploadImage,
      player.avatar_upload,
      player.avatar,
      player.portrait,
      player.head_img,
      player.headImg,
    ];

    for (const raw of candidates) {
      if (raw == null || raw === '') continue;
      let s = String(raw).trim();
      if (!s) continue;

      // Extract path after /cdn/avatar/ or /avatar/ if present
      const marked =
        s.match(/\/cdn\/avatar\/(.+)$/i) ||
        s.match(/(?:^|\/)cdn\/avatar\/(.+)$/i) ||
        s.match(/\/avatar\/(.+)$/i);
      if (marked) {
        s = marked[1];
      } else {
        s = s.replace(/^https?:\/\/[^/]+\//i, ''); // drop any host
        s = s.replace(/^\/+/, '');
        s = s.replace(/^cdn\/avatar\//i, '');
        s = s.replace(/^cdn\//i, '');
        s = s.replace(/^avatar\//i, '');
        s = s.replace(/^\/+/, '');
      }

      s = s.replace(/^\/+/, '');
      if (!s) continue;
      // Final forced URL
      return `${BASE}/${s}`;
    }
    return null;
  })();

  const displayName = player.nick_name || player.nickname || user?.username || 'Player';
  const govId = payload?.governor_id || player.governor_id || player.fid || user?.gameId || '—';

  const cooldownActive = cooldownLeft > 0;
  const cooldownLabel = (() => {
    if (refreshing) return 'Refreshing…';
    if (!cooldownActive) return 'Refresh';
    const s = cooldownLeft;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `Refresh ${m}:${String(r).padStart(2, '0')}`;
  })();

  if (!user) {
    return (
      <div className="profile-page">
        <div className="inventory-card">
          <div className="inventory-card-header">
            <h2 style={{ margin: 0 }}>Profile</h2>
          </div>
          <div className="profile-guest">
            <p className="hint" style={{ margin: 0 }}>
              Log in to view your Kingshot profile.
            </p>
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                setAuthMode('login');
                setAuthOpen(true);
              }}
            >
              Login / Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Identity — single card, no duplicate fields */}
      <div className="inventory-card">
        <div className="inventory-card-header profile-header-row">
          <h2 style={{ margin: 0 }}>Profile</h2>
          <div className="mp-actions">
            <button
              type="button"
              className="preset-btn"
              onClick={refreshPlayer}
              disabled={loading || refreshing || !user.gameId || cooldownActive}
              title={
                cooldownActive
                  ? `Refresh available in ${cooldownLabel.replace('Refresh ', '')}`
                  : 'Refresh live player data'
              }
            >
              {cooldownLabel}
            </button>
            <button type="button" className="preset-btn btn-delete" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {!user.gameId && (
          <p className="hint">
            No Governor ID on your account. Register with your in-game Governor ID so we can load
            your profile.
          </p>
        )}

        {error && (
          <div className="mp-error" role="alert">
            {error}
          </div>
        )}

        {loading && !payload && (
          <p className="hint">Fetching player data…</p>
        )}

        <div className="mp-identity">
          {avatarUrl ? (
            <img
              className="mp-avatar"
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                // last-chance: if URL somehow still has /cdn, strip and retry once
                const el = e.currentTarget;
                if (!el.dataset.retried) {
                  el.dataset.retried = '1';
                  const fixed = el.src
                    .replace(/\/cdn\/avatar\//i, '/avatar/')
                    .replace(
                      /https?:\/\/[^/]+\/cdn\/avatar\//i,
                      'https://got-global-avatar.akamaized.net/avatar/'
                    );
                  if (fixed !== el.src) {
                    el.src = fixed;
                    return;
                  }
                }
                el.style.display = 'none';
                const ph = el.nextElementSibling;
                if (ph) ph.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="mp-avatar mp-avatar-placeholder"
            style={{ display: avatarUrl ? 'none' : 'flex' }}
          >
            {String(displayName).slice(0, 1).toUpperCase()}
          </div>

          <div className="mp-identity-main">
            <div className="mp-nick">{displayName}</div>
            <div className="mp-sub">
              Governor #{govId}
              {player.kid != null && <> · Kingdom {player.kid}</>}
              {player.vip != null && <> · VIP {player.vip}</>}
            </div>
            {alliance && (
              <div className="mp-alliance">
                [{alliance.abbr}] {alliance.name}
                {alliance.rank_label ? ` · ${alliance.rank_label}` : ''}
              </div>
            )}
            <div className="mp-account-line">
              <span>{user.username}</span>
              <span className="mp-dot">·</span>
              <span>{user.email || '—'}</span>
            </div>
          </div>

          <div className="mp-fresh">
            {payload?.fresh === false && <span className="mp-badge">Cached</span>}
            {payload?.age_seconds != null && (
              <span className="hint">Data age {Math.round(payload.age_seconds / 60)}m</span>
            )}
          </div>
        </div>

        {payload && (
          <div className="mp-stats-grid" style={{ marginTop: 14 }}>
            <Stat label="Power" value={fmt(player.power)} highlight />
            <Stat label="Town Center" value={tgShort(player, ranks, payload) || '—'} />
            <Stat label="Kills" value={fmt(player.kills)} />
            <Stat
              label="Alliance"
              value={
                alliance
                  ? `[${alliance.abbr || ''}] ${alliance.name || ''}`.trim()
                  : '—'
              }
            />
          </div>
        )}
      </div>

      {payload && (
        <>
          {ranks && (
            <div className="inventory-card">
              <div className="inventory-card-header">
                <h3 style={{ margin: 0 }}>Kingdom rankings</h3>
              </div>
              <div className="kr-grid">
                {buildKingdomRankRows(ranks, player).map((row) => (
                  <div className="kr-row" key={row.key}>
                    <div className="kr-label">{row.label}</div>
                    <div className="kr-value">{row.value}</div>
                    <div className="kr-rank">{row.rank}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="inventory-card">
            <div className="inventory-card-header">
              <h3 style={{ margin: 0 }}>Arena heroes</h3>
            </div>
            {!heroes.length ? (
              <p className="hint">No arena heroes</p>
            ) : (
              <div className="ah-grid">
                {heroes.map((h, i) => (
                  <ArenaHeroCard key={h.id || h.name || i} hero={h} index={i} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
