import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useGameData } from '../hooks/useGameData';
import { resourceImg } from '../utils/images';
import { formatNumber } from '../utils/calc';

const PAGE_LABELS = {
  buildings: 'Buildings',
  warAcademy: 'War Academy',
  masters: 'Masters',
  widgets: 'Widgets',
  heroes: 'Heroes',
  heroGear: 'Hero Gear',
  govGear: 'Gov Gear',
  govCharm: 'Gov Charm',
  pets: 'Pets',
  troops: 'Troops',
  misc: 'Misc',
};

const LABEL_TO_SCORE_KEY = Object.fromEntries(
  Object.entries(PAGE_LABELS).map(([k, v]) => [v, k])
);
// Forgehammer rolls into heroGear score
LABEL_TO_SCORE_KEY['Forgehammer'] = 'heroGear';

const SECTION_SCAN = [
  ['buildings', 'Buildings'],
  ['warAcademy', 'War Academy'],
  ['masters', 'Masters'],
  ['troops', 'Troops'],
  ['heroes', 'Heroes'],
  ['heroGear', 'Hero Gear'],
  ['govGear', 'Gov Gear'],
  ['govCharm', 'Gov Charm'],
  ['pets', 'Pets'],
  ['widgets', 'Widgets'],
  ['misc', 'Misc'],
];

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src.startsWith('http') || src.startsWith('/') ? src : `/${src}`;
  });
}

function looksLikeId(s) {
  const t = String(s || '');
  if (!t) return true;
  if (/^gear[_-]/i.test(t)) return true;
  if (/^skill\d+/i.test(t)) return true;
  if (/^[a-z0-9]{8,}$/i.test(t) && /[0-9]/.test(t)) return true;
  if (/_[a-z0-9]{4,}$/i.test(t) && t.includes('_') && !/\s/.test(t) && t.length > 12) return true;
  return false;
}

function flowerLabel(idx) {
  if (idx == null || idx < 0) return '0';
  return `★${idx + 1}`;
}

/** Blue ⭐⭐⭐ → Blue 3★ (keeps levels readable in narrow columns) */
function compactLevel(s) {
  let t = String(s ?? '');
  if (!t) return '';
  t = t.replace(/(⭐)+/g, (m) => `${m.length}★`);
  t = t.replace(/(★){2,}/g, (m) => `${m.length}★`);
  return t;
}

function formatRange(from, to) {
  const a = compactLevel(from);
  const b = compactLevel(to);
  if (!a && !b) return '—';
  if (!b || b === '—') return a || '—';
  if (!a) return b;
  return `${a}→${b}`;
}

/** Build masterId/skillKey → skill display name from game data */
function buildMasterSkillNames(mastersData) {
  const map = {};
  if (!mastersData) return map;
  let list = [];
  if (Array.isArray(mastersData)) list = mastersData;
  else if (Array.isArray(mastersData.masters)) list = mastersData.masters;
  else if (typeof mastersData === 'object') {
    list = Object.values(mastersData).filter((x) => x && typeof x === 'object');
  }
  for (const m of list) {
    const mid = String(m.id || m.name || '').toLowerCase();
    const skills = m.skills || m.skill || [];
    const arr = Array.isArray(skills) ? skills : Object.values(skills || {});
    arr.forEach((sk, idx) => {
      if (!sk || typeof sk !== 'object') return;
      const sid = String(sk.id || sk.key || sk.skill_id || `skill${idx}`).toLowerCase();
      const sname = sk.name || sk.title || `Skill ${idx + 1}`;
      map[`${mid}::${sid}`] = sname;
      map[sid] = sname;
      // also numeric id forms skill70042
      if (sk.id != null) map[String(sk.id).toLowerCase()] = sname;
      if (sk.id != null) map[`skill${sk.id}`.toLowerCase()] = sname;
    });
    if (m.talent?.name) {
      map[`${mid}::talent`] = m.talent.name;
      map[`${mid}::talent`] = m.talent.name || 'Talent';
    }
  }
  return map;
}

function collectActiveUpgrades(state, skillNames = {}) {
  const out = [];
  const heroFlowers = state.heroFlowers || {};

  for (const [section, label] of SECTION_SCAN) {
    const block = state[section];
    if (!block || typeof block !== 'object') continue;

    if (section === 'heroGear') {
      const items = Array.isArray(block.items) ? block.items : [];
      items.forEach((it, i) => {
        if (!it || !it.active) return;
        out.push({
          section: label,
          name: `Hero Gear #${i + 1}`,
          from: it.from ?? '',
          to: it.to ?? '',
        });
      });
      const forgeItems = Array.isArray(block.forgeItems) ? block.forgeItems : [];
      forgeItems.forEach((it, i) => {
        if (!it || !it.active) return;
        out.push({
          section: 'Forgehammer',
          name: `Forgehammer #${i + 1}`,
          from: it.from ?? '',
          to: it.to ?? '',
        });
      });
      continue;
    }

    if (section === 'heroes') {
      for (const [heroName, val] of Object.entries(block)) {
        if (!val || typeof val !== 'object' || !val.active) continue;
        if (heroName === 'items' || heroName === 'buffs') continue;
        const fs = heroFlowers[heroName] || {};
        out.push({
          section: label,
          name: heroName,
          from: flowerLabel(fs.currentMaxIdx),
          to:
            fs.targetMaxIdx != null && fs.targetMaxIdx >= 0
              ? flowerLabel(fs.targetMaxIdx)
              : '—',
        });
      }
      continue;
    }

    if (section === 'troops') {
      for (const [key, val] of Object.entries(block)) {
        if (!val || typeof val !== 'object' || !val.active) continue;
        if (key.startsWith('train_')) {
          const type = key.replace('train_', '');
          const level = parseInt(val.level, 10) || 0;
          const qty = parseFloat(val.qty) || 0;
          out.push({
            section: label,
            name: `Train ${type}`,
            from: level > 0 ? `T${level}` : '',
            to: qty > 0 ? `×${formatNumber(qty)}` : '',
            rangeOverride:
              level > 0 && qty > 0
                ? `T${level} ×${formatNumber(qty)}`
                : level > 0
                  ? `T${level}`
                  : qty > 0
                    ? `×${formatNumber(qty)}`
                    : '—',
          });
        } else if (key.startsWith('promo_')) {
          const type = key.replace('promo_', '');
          const from = parseInt(val.from, 10) || 0;
          const to = parseInt(val.to, 10) || 0;
          const qty = parseFloat(val.qty) || 0;
          out.push({
            section: label,
            name: `Promote ${type}`,
            from: from > 0 ? `T${from}` : '',
            to: to > 0 ? `T${to}` : '',
            rangeOverride:
              from > 0 && to > from
                ? `T${from}→T${to}${qty > 0 ? ` ×${formatNumber(qty)}` : ''}`
                : '—',
          });
        } else if (val.active) {
          out.push({
            section: label,
            name: key,
            from: val.from,
            to: val.to,
          });
        }
      }
      continue;
    }

    if (section === 'masters') {
      for (const [masterId, val] of Object.entries(block)) {
        if (!val || typeof val !== 'object') continue;
        if (val.active && (val.from != null || val.to != null)) {
          // top-level active (rare)
          out.push({
            section: label,
            name: masterId,
            from: val.from,
            to: val.to,
          });
        }
        for (const [sk, sv] of Object.entries(val)) {
          if (!sv || typeof sv !== 'object' || !sv.active) continue;
          const mid = String(masterId).toLowerCase();
          const skKey = String(sk).toLowerCase();
          let skillLabel =
            skillNames[`${mid}::${skKey}`] ||
            skillNames[skKey] ||
            skillNames[skKey.replace(/^skill/, '')] ||
            null;
          if (skKey === 'talent' || skKey === 'affinity') {
            skillLabel =
              skillNames[`${mid}::${skKey}`] ||
              (skKey === 'talent' ? 'Talent' : 'Affinity');
          }
          if (!skillLabel) {
            // skill70042 → Skill 70042 as last resort, still better with name from data
            skillLabel = /^skill\d+/i.test(sk)
              ? `Skill ${String(sk).replace(/^skill/i, '')}`
              : sk;
          }
          const masterLabel = masterId.charAt(0).toUpperCase() + masterId.slice(1);
          out.push({
            section: label,
            name: `${masterLabel} · ${skillLabel}`,
            from: sv.from,
            to: sv.to,
          });
        }
      }
      continue;
    }

    // Generic
    if (Array.isArray(block.items)) {
      block.items.forEach((it, i) => {
        if (it && it.active) {
          out.push({
            section: label,
            name:
              it.name && !looksLikeId(it.name)
                ? it.name
                : `${label} #${i + 1}`,
            from: it.from,
            to: it.to,
          });
        }
      });
    }

    for (const [key, val] of Object.entries(block)) {
      if (key === 'items' || key === 'forgeItems' || key === 'buffs') continue;
      if (!val || typeof val !== 'object') continue;
      if (val.active) {
        out.push({
          section: label,
          name: val.name && !looksLikeId(val.name) ? val.name : key,
          from: val.from,
          to: val.to,
        });
      }
      for (const [sk, sv] of Object.entries(val)) {
        if (sv && typeof sv === 'object' && sv.active) {
          out.push({
            section: label,
            name: `${key} · ${sk}`,
            from: sv.from,
            to: sv.to,
          });
        }
      }
    }
  }
  return out;
}

function aggregateLockedResources(lockedUpgrades) {
  const totals = {};
  for (const page of Object.values(lockedUpgrades || {})) {
    if (!page || typeof page !== 'object') continue;
    for (const [k, v] of Object.entries(page)) {
      const n = Number(v) || 0;
      if (n > 0) totals[k] = (totals[k] || 0) + n;
    }
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function truncate(ctx, text, maxW) {
  const s = String(text ?? '');
  if (maxW <= 0) return s;
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function groupActivesByPage(actives) {
  const map = new Map();
  for (const u of actives) {
    const key = u.section || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(u);
  }
  const ordered = [];
  const seen = new Set();
  for (const [, label] of SECTION_SCAN) {
    if (map.has(label)) {
      ordered.push([label, map.get(label)]);
      seen.add(label);
    }
  }
  for (const [k, list] of map) {
    if (!seen.has(k)) ordered.push([k, list]);
  }
  return ordered;
}

function pairColsFor(count) {
  if (count <= 0) return 1;
  return Math.min(4, count);
}

function rangeText(u) {
  if (u.rangeOverride) return u.rangeOverride;
  return formatRange(u.from, u.to);
}

/**
 * Measure content and return pair widths that hug text (min share, sum = tableW).
 */
function computePairWidths(ctx, list, cols, tableW, gap) {
  const n = cols;
  const weights = new Array(n).fill(0);
  ctx.font = '13px system-ui, Segoe UI, sans-serif';
  for (let i = 0; i < list.length; i++) {
    const col = i % n;
    const u = list[i];
    const nameW = ctx.measureText(String(u.name || '')).width;
    const lvlW = ctx.measureText(rangeText(u)).width;
    // name + levels + padding
    const need = nameW + lvlW + 28;
    weights[col] = Math.max(weights[col], need);
  }
  const minW = 80;
  for (let c = 0; c < n; c++) weights[c] = Math.max(minW, weights[c]);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  // scale to tableW
  const scale = tableW / sum;
  return weights.map((w) => w * scale);
}

export function useShareCardPng() {
  const { state, globalScore, currentName } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const { data: mastersData } = useGameData('masters');
  const [busy, setBusy] = useState(false);

  const downloadSharePng = useCallback(async () => {
    setBusy(true);
    try {
      const skillNames = buildMasterSkillNames(mastersData);
      const scores = state.pageScores || {};
      const eventId = String(state.settings?.activeEvent || 'sg').toUpperCase();
      const nick = user?.username || currentName || 'Governor';
      const actives = collectActiveUpgrades(state, skillNames);
      const byPage = groupActivesByPage(actives);
      const resources = aggregateLockedResources(state.lockedUpgrades);
      const iconEntries = await Promise.all(
        resources.map(async ([key]) => [key, await loadImage(resourceImg(key))])
      );
      const icons = Object.fromEntries(iconEntries);

      const SCALE = 3;
      const LW = 1280;
      const pad = 40;
      const gap = 14;
      const resCols = 4;

      const resRowH = 40;
      const resRowsN = Math.ceil(resources.length / resCols) || (resources.length ? 0 : 1);
      const pageTitleH = 30;
      const pageHeaderH = 22;
      const upgRowH = 26;
      const pageGap = 18;
      const sectionGap = 26;

      let upgradesBlockH = 0;
      if (!byPage.length) {
        upgradesBlockH = 28;
      } else {
        for (const [, list] of byPage) {
          const cols = pairColsFor(list.length);
          const rows = Math.ceil(list.length / cols) || 1;
          upgradesBlockH += pageTitleH + pageHeaderH + rows * upgRowH + pageGap;
        }
      }

      const headerH = 150;
      const logicalH =
        headerH +
        36 +
        upgradesBlockH +
        sectionGap +
        36 +
        resRowsN * resRowH +
        48;

      const W = LW * SCALE;
      const H = Math.round(logicalH * SCALE);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(SCALE, SCALE);

      const bg = ctx.createLinearGradient(0, 0, LW, logicalH);
      bg.addColorStop(0, '#12151c');
      bg.addColorStop(1, '#243049');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, LW, logicalH);
      ctx.strokeStyle = 'rgba(240, 200, 100, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(12, 12, LW - 24, logicalH - 24);

      let y = 52;
      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 28px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Kingshot Event Calculator', pad, y);
      y += 28;
      ctx.fillStyle = '#b8c0d0';
      ctx.font = '16px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`${nick}  ·  Event ${eventId}  ·  Full preset`, pad, y);
      y += 40;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`${Number(globalScore || 0).toLocaleString()} pts`, pad, y);
      y += 24;
      ctx.fillStyle = '#8b93a7';
      ctx.font = '14px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Total event points (all pages)', pad, y);
      y += 36;


      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 18px system-ui, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        actives.length ? `Active upgrades (${actives.length})` : 'Active upgrades',
        pad,
        y
      );
      y += 28;

      if (!byPage.length) {
        ctx.fillStyle = '#9aa3b5';
        ctx.font = '15px system-ui, Segoe UI, sans-serif';
        ctx.fillText('No upgrades marked Active', pad, y);
        y += 28;
      } else {
        const tableW = LW - pad * 2;

        for (const [pageName, list] of byPage) {
          const cols = pairColsFor(list.length);
          const rows = Math.ceil(list.length / cols) || 1;
          const pairWidths = computePairWidths(ctx, list, cols, tableW, 8);
          const pairGap = 8;

          const tableTop = y - 18;
          const bodyH = rows * upgRowH;
          const tableH = pageTitleH + pageHeaderH - 4 + bodyH + 8;

          ctx.strokeStyle = 'rgba(240, 200, 100, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(pad - 6, tableTop, tableW + 12, tableH);

          ctx.fillStyle = 'rgba(240, 200, 100, 0.14)';
          ctx.fillRect(pad - 6, tableTop, tableW + 12, pageTitleH);
          ctx.fillStyle = '#f0d78c';
          ctx.font = 'bold 16px system-ui, Segoe UI, sans-serif';
          ctx.textAlign = 'left';
          const scoreKey = LABEL_TO_SCORE_KEY[pageName];
          const pagePts = scoreKey ? Number(scores[scoreKey]) || 0 : 0;
          const ptsPart = pagePts > 0 ? `  ·  ${pagePts.toLocaleString()} pts` : '';
          ctx.fillText(`${pageName}  (${list.length})${ptsPart}`, pad, y);
          y += pageTitleH - 4;

          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(pad - 6, y - 14, tableW + 12, pageHeaderH);
          ctx.fillStyle = '#f0d78c';
          ctx.font = 'bold 11px system-ui, Segoe UI, sans-serif';
          let hx = pad;
          for (let c = 0; c < cols; c++) {
            const pw = pairWidths[c];
            ctx.textAlign = 'left';
            ctx.fillText('UPGRADE', hx + 4, y);
            ctx.textAlign = 'right';
            ctx.fillText('LEVELS', hx + pw - 4, y);
            hx += pw;
          }
          ctx.textAlign = 'left';
          y += pageHeaderH;

          const dataTop = y - 16;
          for (let r = 0; r < rows; r++) {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(pad - 6, dataTop + r * upgRowH, tableW + 12, upgRowH);
          }

          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1;
          let vx = pad;
          for (let c = 0; c < cols - 1; c++) {
            vx += pairWidths[c];
            ctx.beginPath();
            ctx.moveTo(vx, tableTop + pageTitleH);
            ctx.lineTo(vx, dataTop + bodyH);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(pad - 6, dataTop);
          ctx.lineTo(pad + tableW + 6, dataTop);
          ctx.stroke();

          for (let i = 0; i < list.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            let x0 = pad;
            for (let c = 0; c < col; c++) x0 += pairWidths[c];
            const pw = pairWidths[col];
            const yy = y + row * upgRowH;
            const u = list[i];
            const range = rangeText(u);

            // ~65% name, 35% levels within pair
            const nameMax = pw * 0.62 - 8;
            const levelMax = pw * 0.38 - 8;

            ctx.font = '13px system-ui, Segoe UI, sans-serif';
            ctx.fillStyle = '#e8ecf4';
            ctx.textAlign = 'left';
            ctx.fillText(truncate(ctx, u.name, nameMax), x0 + 4, yy);
            ctx.fillStyle = '#c8d0e0';
            ctx.textAlign = 'right';
            ctx.fillText(truncate(ctx, range, levelMax), x0 + pw - 6, yy);
            ctx.textAlign = 'left';
          }
          y += rows * upgRowH + pageGap;
        }
      }

      y += 8;

      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 18px system-ui, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        resources.length ? `Resources used (${resources.length})` : 'Resources used',
        pad,
        y
      );
      y += 30;

      if (!resources.length) {
        ctx.fillStyle = '#9aa3b5';
        ctx.font = '15px system-ui, Segoe UI, sans-serif';
        ctx.fillText('Mark upgrades Active to include resource totals', pad, y);
      } else {
        const colW = (LW - pad * 2 - gap * (resCols - 1)) / resCols;
        const iconSize = 24;
        const amountW = 88;
        const resTop = y - 18;
        const resH = resRowsN * resRowH + 8;

        ctx.strokeStyle = 'rgba(240, 200, 100, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pad - 6, resTop, LW - pad * 2 + 12, resH);

        for (let r = 0; r < resRowsN; r++) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(pad - 6, resTop + r * resRowH, LW - pad * 2 + 12, resRowH);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        for (let c = 1; c < resCols; c++) {
          const vx = pad + c * (colW + gap) - gap / 2;
          ctx.beginPath();
          ctx.moveTo(vx, resTop);
          ctx.lineTo(vx, resTop + resRowsN * resRowH);
          ctx.stroke();
        }

        for (let i = 0; i < resources.length; i++) {
          const col = i % resCols;
          const row = Math.floor(i / resCols);
          const x = pad + col * (colW + gap);
          const yy = y + row * resRowH;
          const [key, amt] = resources[i];
          const icon = icons[key];
          if (icon) {
            ctx.drawImage(icon, x + 4, yy - 18, iconSize, iconSize);
          }
          const label = String(key).replace(/_/g, ' ');
          const nameX = x + iconSize + 12;
          const nameMaxW = colW - iconSize - 16 - amountW;
          ctx.font = '14px system-ui, Segoe UI, sans-serif';
          ctx.fillStyle = '#e8ecf4';
          ctx.textAlign = 'left';
          ctx.fillText(truncate(ctx, label, Math.max(20, nameMaxW)), nameX, yy);
          ctx.fillStyle = '#c8d0e0';
          ctx.textAlign = 'right';
          ctx.fillText(formatNumber(amt), x + colW - 6, yy);
          ctx.textAlign = 'left';
        }
        y += resRowsN * resRowH;
      }

      y += 28;
      ctx.fillStyle = '#6b7385';
      ctx.font = '12px system-ui, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(new Date().toLocaleString(), pad, Math.min(y, logicalH - 20));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png', 1);
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kingshot-share-${String(nick).replace(/[^\w.-]+/g, '_').slice(0, 24)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Share card downloaded');
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Could not create share card');
    } finally {
      setBusy(false);
    }
  }, [state, globalScore, currentName, user, toast, mastersData]);

  return { downloadSharePng, busy };
}
