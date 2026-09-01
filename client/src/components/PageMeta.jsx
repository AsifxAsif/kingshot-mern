import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'Kingshot Calculator';
const BASE_DESC =
  'Kingshot Strongest Governor event calculator. Plan buildings, troops, heroes, gear, pets and track event points.';
const BASE_KEYWORDS =
  'Kingshot, Strongest Governor, calculator, event points, buildings, troops, heroes, pets, war academy';

const PAGE_META = {
  '/': {
    title: `Vault · ${SITE}`,
    description:
      'Manage your Kingshot resource vault: bread, wood, stone, iron, truegold, speedups and more.',
    keywords: `${BASE_KEYWORDS}, vault, resources`,
  },
  '/buildings': {
    title: `Buildings · ${SITE}`,
    description: 'Calculate Kingshot building upgrade costs, time and Strongest Governor points.',
    keywords: `${BASE_KEYWORDS}, buildings, town center, barracks`,
  },
  '/war-academy': {
    title: `War Academy · ${SITE}`,
    description: 'Plan War Academy Truegold research upgrades, costs and event points.',
    keywords: `${BASE_KEYWORDS}, war academy, research, truegold`,
  },
  '/widgets': {
    title: `Widgets · ${SITE}`,
    description: 'Track hero widget upgrades and Strongest Governor event points.',
    keywords: `${BASE_KEYWORDS}, widgets, hero widgets`,
  },
  '/heroes': {
    title: `Heroes · ${SITE}`,
    description: 'Plan hero star level upgrades, shards and event points for Kingshot.',
    keywords: `${BASE_KEYWORDS}, heroes, star level, shards`,
  },
  '/hero-gear': {
    title: `Hero Gear · ${SITE}`,
    description: 'Calculate hero gear and forgehammer mastery costs and points.',
    keywords: `${BASE_KEYWORDS}, hero gear, forgehammer, mithril`,
  },
  '/gov-gear': {
    title: `Governor Gear · ${SITE}`,
    description: 'Governor gear upgrade calculator for satin, threads and artisan vision.',
    keywords: `${BASE_KEYWORDS}, governor gear, satin, mithril`,
  },
  '/gov-charm': {
    title: `Governor Charm · ${SITE}`,
    description: 'Governor charm upgrade calculator for guides, designs and event points.',
    keywords: `${BASE_KEYWORDS}, governor charm, charm design`,
  },
  '/pets': {
    title: `Pets · ${SITE}`,
    description: 'Pet upgrade and taming mark points calculator for Kingshot events.',
    keywords: `${BASE_KEYWORDS}, pets, taming marks, grey wolf`,
  },
  '/troops': {
    title: `Troops · ${SITE}`,
    description: 'Troop training and promotion cost and points calculator.',
    keywords: `${BASE_KEYWORDS}, troops, infantry, cavalry, archer`,
  },
  '/misc': {
    title: `Misc · ${SITE}`,
    description: 'Hero roulette and gathering points calculator for Strongest Governor.',
    keywords: `${BASE_KEYWORDS}, gathering, hero roulette`,
  },
  '/profile': {
    title: `Profile · ${SITE}`,
    description: 'Your Kingshot calculator profile, presets and account settings.',
    keywords: `${BASE_KEYWORDS}, profile, account, presets`,
  },
};

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function PageMeta() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] || {
    title: SITE,
    description: BASE_DESC,
    keywords: BASE_KEYWORDS,
  };

  useEffect(() => {
    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'keywords', meta.keywords || BASE_KEYWORDS);
    upsertMeta('name', 'robots', 'index, follow');
    upsertMeta('name', 'author', SITE);
    upsertMeta('name', 'application-name', SITE);
    upsertMeta('name', 'theme-color', '#0d6e62');
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SITE);
    upsertMeta('property', 'og:locale', 'en_US');
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
  }, [pathname, meta.title, meta.description, meta.keywords]);

  return null;
}
