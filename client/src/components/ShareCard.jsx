import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resourceImg, asset } from '../utils/images';
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

/** Collect ACTIVE upgrades from preset state (overall preset, not a single page). */
function collectActiveUpgrades(state) {
  const out = [];
  for (const [section, label] of SECTION_SCAN) {
    const block = state[section];
    if (!block || typeof block !== 'object') continue;

    // Multi-item lists (hero gear etc.)
    if (Array.isArray(block.items)) {
      block.items.forEach((it, i) => {
        if (it && it.active) {
          out.push({
            section: label,
            name: it.name || it.id || `${label} #${i + 1}`,
            from: it.from,
            to: it.to,
          });
        }
      });
    }
    if (Array.isArray(block.forgeItems)) {
      block.forgeItems.forEach((it, i) => {
        if (it && it.active) {
          out.push({
            section: 'Forgehammer',
            name: it.name || `Forgehammer #${i + 1}`,
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
        const name = val.name || key;
        out.push({
          section: label,
          name,
          from: val.from,
          to: val.to,
        });
      }
      // Nested master skills: masters[masterId][skillKey]
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

/**
 * Share PNG for the **whole active preset**: total points, active upgrades, resources used.
 */
export function useShareCardPng() {
  const { state, globalScore, currentName } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const downloadSharePng = useCallback(async () => {
    setBusy(true);
    try {
      const scores = state.pageScores || {};
      const eventId = String(state.settings?.activeEvent || 'sg').toUpperCase();
      const nick = user?.username || currentName || 'Governor';
      const actives = collectActiveUpgrades(state);
      const resources = aggregateLockedResources(state.lockedUpgrades);
      const scoreRows = Object.entries(PAGE_LABELS)
        .map(([k, label]) => [k, label, Number(scores[k]) || 0])
        .filter(([, , p]) => p > 0);

      const iconEntries = await Promise.all(
        resources.slice(0, 16).map(async ([key]) => [key, await loadImage(resourceImg(key))])
      );
      const icons = Object.fromEntries(iconEntries);

      // 4K output: design at 960 CSS px, render at 4× → 3840px wide (UHD)
      const SCALE = 4;
      const LW = 960; // logical width
      const pad = 48;
      const maxActives = 30;
      const maxRes = 16;
      const logicalH = Math.max(
        540,
        180 +
          scoreRows.length * 36 +
          40 +
          Math.min(actives.length, maxActives) * 34 +
          40 +
          Math.min(Math.max(resources.length, 1), maxRes) * 44 +
          100
      );
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
      bg.addColorStop(0.5, '#1a2233');
      bg.addColorStop(1, '#243049');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, LW, logicalH);

      ctx.strokeStyle = 'rgba(240, 200, 100, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, LW - 28, logicalH - 28);

      let y = 64;
      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 32px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Kingshot Event Calculator', pad, y);
      y += 34;
      ctx.fillStyle = '#b8c0d0';
      ctx.font = '18px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`${nick}  ·  Event ${eventId}  ·  Full preset`, pad, y);
      y += 48;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 52px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`${Number(globalScore || 0).toLocaleString()} pts`, pad, y);
      y += 32;
      ctx.fillStyle = '#8b93a7';
      ctx.font = '16px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Total event points (all pages)', pad, y);
      y += 42;

      if (scoreRows.length) {
        ctx.fillStyle = '#f0d78c';
        ctx.font = 'bold 20px system-ui, Segoe UI, sans-serif';
        ctx.fillText('Page scores', pad, y);
        y += 32;
        ctx.font = '18px system-ui, Segoe UI, sans-serif';
        for (const [, label, pts] of scoreRows) {
          ctx.fillStyle = '#9aa3b5';
          ctx.textAlign = 'left';
          ctx.fillText(label, pad, y);
          ctx.fillStyle = '#e8ecf4';
          ctx.textAlign = 'right';
          ctx.fillText(`${pts.toLocaleString()} pts`, LW - pad, y);
          ctx.textAlign = 'left';
          y += 34;
        }
        y += 16;
      }

      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 20px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        actives.length ? `Active upgrades (${actives.length})` : 'Active upgrades',
        pad,
        y
      );
      y += 32;
      ctx.font = '17px system-ui, Segoe UI, sans-serif';
      if (!actives.length) {
        ctx.fillStyle = '#9aa3b5';
        ctx.fillText('No upgrades marked Active in this preset', pad, y);
        y += 32;
      } else {
        const shown = actives.slice(0, maxActives);
        for (const u of shown) {
          const range =
            u.from != null && u.to != null && String(u.from) !== '' && String(u.to) !== ''
              ? `  ${u.from} → ${u.to}`
              : '';
          ctx.fillStyle = '#9aa3b5';
          ctx.fillText(`${u.section}`, pad, y);
          ctx.fillStyle = '#e8ecf4';
          ctx.fillText(`${u.name}${range}`, pad + 150, y);
          y += 32;
        }
        if (actives.length > maxActives) {
          ctx.fillStyle = '#8b93a7';
          ctx.fillText(`+${actives.length - maxActives} more…`, pad, y);
          y += 32;
        }
      }
      y += 16;

      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 20px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Resources used (Active upgrades)', pad, y);
      y += 36;
      if (!resources.length) {
        ctx.fillStyle = '#9aa3b5';
        ctx.font = '17px system-ui, Segoe UI, sans-serif';
        ctx.fillText('Mark upgrades Active to include resource totals', pad, y);
        y += 32;
      } else {
        for (const [key, amt] of resources.slice(0, maxRes)) {
          const icon = icons[key];
          const iconSize = 32;
          if (icon) {
            ctx.drawImage(icon, pad, y - 24, iconSize, iconSize);
          }
          const label = String(key).replace(/_/g, ' ');
          ctx.fillStyle = '#e8ecf4';
          ctx.font = '18px system-ui, Segoe UI, sans-serif';
          ctx.fillText(label, pad + iconSize + 12, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatNumber(amt), LW - pad, y);
          ctx.textAlign = 'left';
          y += 42;
        }
      }

      y += 20;
      ctx.fillStyle = '#6b7385';
      ctx.font = '14px system-ui, Segoe UI, sans-serif';
      ctx.fillText(new Date().toLocaleString(), pad, Math.min(y, logicalH - 28));

      // Reset transform before export (blob uses full pixel buffer)
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('PNG failed'))),
          'image/png',
          1.0
        );
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
  }, [state, globalScore, currentName, user, toast]);

  return { downloadSharePng, busy };
}
