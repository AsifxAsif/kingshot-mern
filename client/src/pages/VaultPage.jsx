import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useScoreRules } from '../hooks/useScoreRules';
import { RESOURCE_ITEMS } from '../utils/calc';
import { VAULT_EVENT_EXTRA } from '../utils/events';
import AssetImg from '../components/AssetImg';
import { resourceImg, asset } from '../utils/images';

const HID = '__hid__';

function apiBase() {
  const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '/api';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

/**
 * Build visible vault list from site_config.
 * - Honours order array
 * - Skips __hid__* and hidden[] ids
 * - Never re-appends missing items (that caused "hidden at the end")
 */
function buildVaultItems(orderArr, hiddenArr) {
  const ban = new Set();
  for (const h of hiddenArr || []) {
    const s = String(h || '').trim();
    if (!s) continue;
    ban.add(s.startsWith(HID) ? s.slice(HID.length) : s);
  }
  for (const raw of orderArr || []) {
    const s = String(raw || '').trim();
    if (s.startsWith(HID)) ban.add(s.slice(HID.length));
  }

  const byId = new Map(RESOURCE_ITEMS.map((it) => [String(it.id), it]));

  if (Array.isArray(orderArr) && orderArr.length > 0) {
    const out = [];
    const seen = new Set();
    for (const raw of orderArr) {
      const s = String(raw || '').trim();
      if (!s || s.startsWith(HID)) continue;
      if (ban.has(s) || seen.has(s)) continue;
      const it = byId.get(s);
      if (it) {
        out.push(it);
        seen.add(s);
      }
    }
    return out;
  }

  return RESOURCE_ITEMS.filter((it) => !ban.has(String(it.id)));
}

export default function VaultPage() {
  const { vault, updateVaultField } = useApp();
  const { event, eventId } = useScoreRules();
  const extras = (VAULT_EVENT_EXTRA[eventId] || []).filter((x) => x.vault);

  const [orderArr, setOrderArr] = useState([]);
  const [hiddenArr, setHiddenArr] = useState([]);
  const [cfgLoaded, setCfgLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${apiBase()}/site-config?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setOrderArr(
            Array.isArray(data?.orders?.vault_resources) ? data.orders.vault_resources : []
          );
          setHiddenArr(
            Array.isArray(data?.hidden?.vault_resources) ? data.hidden.vault_resources : []
          );
        })
        .catch(() => {
          if (!cancelled) {
            setOrderArr([]);
            setHiddenArr([]);
          }
        })
        .finally(() => {
          if (!cancelled) setCfgLoaded(true);
        });
    };
    load();
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const items = useMemo(
    () => buildVaultItems(orderArr, hiddenArr),
    [orderArr, hiddenArr]
  );

  return (
    <div className="vault-section">
      <h2>
        <AssetImg
          src={asset('vault_icon.webp')}
          size={28}
          style={{ marginRight: 8, verticalAlign: 'middle' }}
        />
        RESOURCE VAULT
      </h2>

      <h3 className="vault-subhead">Common resources</h3>
      <div className="vault-grid">
        {items.map((item) => (
          <div
            className="vault-item"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            key={item.id}
          >
            <div className="vault-label">
              <AssetImg src={resourceImg(item.id)} size={36} />
              <label htmlFor={item.id}>{item.label}</label>
            </div>
            <input
              id={item.id}
              type="text"
              placeholder={item.placeholder}
              value={
                vault?.[item.id] === 0 || vault?.[item.id] === '0'
                  ? ''
                  : (vault?.[item.id] ?? '')
              }
              onChange={(e) => updateVaultField(item.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      {extras.length > 0 && (
        <>
          <h3 className="vault-subhead" style={{ marginTop: 20 }}>
            {event.name} — extra vault
          </h3>
          <div className="vault-grid">
            {extras.map((item) => (
              <div
                className="vault-item"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                key={item.id}
              >
                <div className="vault-label">
                  <AssetImg src={resourceImg(item.id)} size={36} />
                  <label htmlFor={item.id}>{item.label}</label>
                </div>
                <input
                  id={item.id}
                  type="text"
                  placeholder={item.placeholder || '0'}
                  value={
                    vault?.[item.id] === 0 || vault?.[item.id] === '0'
                      ? ''
                      : (vault?.[item.id] ?? '')
                  }
                  onChange={(e) => updateVaultField(item.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
