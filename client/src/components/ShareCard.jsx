import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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

function collectActiveUpgrades(state) {
  const out = [];
  for (const [section, label] of SECTION_SCAN) {
    const block = state[section];
    if (!block || typeof block !== 'object') continue;

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
        out.push({
          section: label,
          name: val.name || key,
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
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Share PNG — multi-column tables, high-res, all actives + resources (no +N more).
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
        resources.map(async ([key]) => [key, await loadImage(resourceImg(key))])
      );
      const icons = Object.fromEntries(iconEntries);

      // High-res: logical landscape-ish width, 3× scale → sharp PNG (~2880–3840 wide)
      const SCALE = 3;
      const LW = 1280;
      const pad = 40;
      const gap = 16;

      // Column counts for tables
      const scoreCols = 3;
      const activeCols = 3;
      const resCols = 4;

      const scoreRowsN = Math.ceil(scoreRows.length / scoreCols) || 0;
      const activeRowsN = Math.ceil(actives.length / activeCols) || (actives.length ? 0 : 1);
      const resRowsN = Math.ceil(resources.length / resCols) || (resources.length ? 0 : 1);

      const headerH = 150;
      const sectionTitleH = 36;
      const scoreRowH = 30;
      const activeRowH = 28;
      const resRowH = 36;
      const sectionGap = 28;

      const logicalH =
        headerH +
        sectionTitleH +
        scoreRowsN * scoreRowH +
        sectionGap +
        sectionTitleH +
        activeRowsN * activeRowH +
        sectionGap +
        sectionTitleH +
        resRowsN * resRowH +
        50;

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

      // --- Page scores table (3 columns) ---
      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 18px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Page scores', pad, y);
      y += 28;
      if (!scoreRows.length) {
        ctx.fillStyle = '#9aa3b5';
        ctx.font = '15px system-ui, Segoe UI, sans-serif';
        ctx.fillText('No page scores yet', pad, y);
        y += scoreRowH;
      } else {
        const colW = (LW - pad * 2 - gap * (scoreCols - 1)) / scoreCols;
        for (let i = 0; i < scoreRows.length; i++) {
          const col = i % scoreCols;
          const row = Math.floor(i / scoreCols);
          const x = pad + col * (colW + gap);
          const yy = y + row * scoreRowH;
          const [, label, pts] = scoreRows[i];
          ctx.fillStyle = '#9aa3b5';
          ctx.font = '15px system-ui, Segoe UI, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(truncate(ctx, label, colW * 0.55), x, yy);
          ctx.fillStyle = '#e8ecf4';
          ctx.textAlign = 'right';
          ctx.fillText(`${pts.toLocaleString()}`, x + colW, yy);
          ctx.textAlign = 'left';
        }
        y += scoreRowsN * scoreRowH + sectionGap;
      }

      // --- Active upgrades table (3 columns) ---
      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 18px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        actives.length ? `Active upgrades (${actives.length})` : 'Active upgrades',
        pad,
        y
      );
      y += 28;
      if (!actives.length) {
        ctx.fillStyle = '#9aa3b5';
        ctx.font = '15px system-ui, Segoe UI, sans-serif';
        ctx.fillText('No upgrades marked Active', pad, y);
        y += activeRowH + sectionGap;
      } else {
        // Table header
        const colW = (LW - pad * 2 - gap * (activeCols - 1)) / activeCols;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(pad - 4, y - 18, LW - pad * 2 + 8, 22);
        ctx.fillStyle = '#8b93a7';
        ctx.font = 'bold 12px system-ui, Segoe UI, sans-serif';
        for (let c = 0; c < activeCols; c++) {
          const x = pad + c * (colW + gap);
          ctx.fillText('PAGE', x, y);
          ctx.fillText('UPGRADE', x + colW * 0.28, y);
          ctx.textAlign = 'right';
          ctx.fillText('LEVELS', x + colW, y);
          ctx.textAlign = 'left';
        }
        y += 22;

        for (let i = 0; i < actives.length; i++) {
          const col = i % activeCols;
          const row = Math.floor(i / activeCols);
          const x = pad + col * (colW + gap);
          const yy = y + row * activeRowH;
          if (row % 2 === 0 && col === 0) {
            // subtle row band across full width once per row
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(pad - 4, yy - 16, LW - pad * 2 + 8, activeRowH);
          }
          const u = actives[i];
          const range =
            u.from != null && u.to != null && String(u.from) !== '' && String(u.to) !== ''
              ? `${u.from}→${u.to}`
              : '—';
          ctx.font = '13px system-ui, Segoe UI, sans-serif';
          ctx.fillStyle = '#9aa3b5';
          ctx.fillText(truncate(ctx, u.section, colW * 0.26), x, yy);
          ctx.fillStyle = '#e8ecf4';
          ctx.fillText(truncate(ctx, u.name, colW * 0.42), x + colW * 0.28, yy);
          ctx.fillStyle = '#c8d0e0';
          ctx.textAlign = 'right';
          ctx.fillText(truncate(ctx, range, colW * 0.28), x + colW, yy);
          ctx.textAlign = 'left';
        }
        y += activeRowsN * activeRowH + sectionGap;
      }

      // --- Resources table (4 columns) ---
      ctx.fillStyle = '#f0d78c';
      ctx.font = 'bold 18px system-ui, Segoe UI, sans-serif';
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
        const iconSize = 22;
        for (let i = 0; i < resources.length; i++) {
          const col = i % resCols;
          const row = Math.floor(i / resCols);
          const x = pad + col * (colW + gap);
          const yy = y + row * resRowH;
          const [key, amt] = resources[i];
          const icon = icons[key];
          if (icon) ctx.drawImage(icon, x, yy - 16, iconSize, iconSize);
          const label = String(key).replace(/_/g, ' ');
          ctx.font = '14px system-ui, Segoe UI, sans-serif';
          ctx.fillStyle = '#e8ecf4';
          ctx.fillText(truncate(ctx, label, colW - iconSize - 8), x + iconSize + 6, yy);
          ctx.fillStyle = '#c8d0e0';
          ctx.textAlign = 'right';
          ctx.fillText(formatNumber(amt), x + colW, yy + 14);
          ctx.textAlign = 'left';
        }
        y += resRowsN * resRowH;
      }

      y += 24;
      ctx.fillStyle = '#6b7385';
      ctx.font = '12px system-ui, Segoe UI, sans-serif';
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
  }, [state, globalScore, currentName, user, toast]);

  return { downloadSharePng, busy };
}
