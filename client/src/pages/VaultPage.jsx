import { useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { RESOURCE_ITEMS, SCORE_RULES, parseCost, formatNumber } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import { resourceImg, asset } from '../utils/images';

/**
 * Manual "use X taming marks" card on Vault.
 * Inventory still lives in the vault inputs above;
 * this card only records how many marks the player plans to spend for event points.
 */
function TamingMarksCard() {
  const { state, updateSection, setPageScore, setPageLockedCosts, vault } = useApp();
  const usage = state.settings?.tamingMarks || {};

  const advancedQty = parseCost(usage.advanced);
  const commonQty = parseCost(usage.common);
  const active = !!usage.active;

  const advancedPts = advancedQty * (SCORE_RULES.advanced_taming_mark || 15000);
  const commonPts = commonQty * (SCORE_RULES.common_taming_mark || 1150);
  const totalPts = advancedPts + commonPts;
  const scoredPts = active ? totalPts : 0;

  const vaultAdv = parseCost(vault?.advanced_taming_mark);
  const vaultCommon = parseCost(vault?.common_taming_mark);

  const setUsage = (field, value) => {
    updateSection('settings', (prev) => ({
      ...prev,
      tamingMarks: {
        ...(prev.tamingMarks || {}),
        [field]: value,
      },
    }));
  };

  // Publish page score → included in global score + saved to Mongo preset.pageScores.vault
  useEffect(() => {
    setPageScore('vault', scoredPts);
  }, [scoredPts, setPageScore]);

  // When Active, reserve marks from remaining vault so other pages see reduced stock
  useEffect(() => {
    if (!active) {
      setPageLockedCosts('vault', {});
      return;
    }
    const locked = {};
    if (advancedQty > 0) locked.advanced_taming_mark = advancedQty;
    if (commonQty > 0) locked.common_taming_mark = commonQty;
    setPageLockedCosts('vault', locked);
  }, [active, advancedQty, commonQty, setPageLockedCosts]);

  const overAdv = active && advancedQty > vaultAdv;
  const overCommon = active && commonQty > vaultCommon;

  return (
    <div className="item-card" style={{ marginTop: 20, marginBottom: 8 }}>
      <div className="item-card-header">
        <AssetImg src={resourceImg('advanced_taming_mark')} size={40} alt="Taming Marks" />
        <span>TAMING MARKS POINTS</span>
      </div>
      <div className="item-card-body">
        <p style={{ margin: '0 0 12px', opacity: 0.85, fontSize: '0.9rem' }}>
          Enter how many marks you will use for pet refine (event points). Inventory is set in the
          vault fields above.
        </p>

        <div className="buff-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div className="buff-field" style={{ flex: '1 1 160px' }}>
            <label className="img-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AssetImg src={resourceImg('advanced_taming_mark')} size={22} />
              <span>Advanced Taming Mark (use)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 5 or 1.2K"
              value={usage.advanced ?? ''}
              onChange={(e) => setUsage('advanced', e.target.value)}
              style={{ textAlign: 'center', width: '100%' }}
            />
            <small style={{ opacity: 0.75 }}>
              Vault: {formatNumber(vaultAdv)} · {formatNumber(SCORE_RULES.advanced_taming_mark)} pts
              each
            </small>
          </div>

          <div className="buff-field" style={{ flex: '1 1 160px' }}>
            <label className="img-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AssetImg src={resourceImg('common_taming_mark')} size={22} />
              <span>Common Taming Mark (use)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 20 or 500"
              value={usage.common ?? ''}
              onChange={(e) => setUsage('common', e.target.value)}
              style={{ textAlign: 'center', width: '100%' }}
            />
            <small style={{ opacity: 0.75 }}>
              Vault: {formatNumber(vaultCommon)} · {formatNumber(SCORE_RULES.common_taming_mark)} pts
              each
            </small>
          </div>
        </div>

        <div className="misc-lcd" style={{ marginTop: 14 }}>
          <div className="misc-lcd-row">
            <span>Advanced points:</span>
            <span className="misc-lcd-value">{formatNumber(advancedPts)}</span>
          </div>
          <div className="misc-lcd-row">
            <span>Common points:</span>
            <span className="misc-lcd-value">{formatNumber(commonPts)}</span>
          </div>
          <div className="misc-lcd-row">
            <span>
              <strong>Total points:</strong>
            </span>
            <span className="misc-lcd-value">
              <strong>{formatNumber(totalPts)}</strong>
            </span>
          </div>
        </div>

        {(overAdv || overCommon) && (
          <p style={{ color: '#c0392b', marginTop: 8, fontSize: '0.85rem' }}>
            Warning: usage exceeds vault stock
            {overAdv ? ' (Advanced)' : ''}
            {overCommon ? ' (Common)' : ''}.
          </p>
        )}

        <label className="checkbox-label" style={{ marginTop: 12, display: 'inline-flex' }}>
          <input
            className="checkbox"
            type="checkbox"
            checked={active}
            onChange={(e) => setUsage('active', e.target.checked)}
          />
          <span>Count taming mark points</span>
        </label>
        {active && scoredPts > 0 && (
          <p style={{ marginTop: 6, opacity: 0.8, fontSize: '0.85rem' }}>
            +{formatNumber(scoredPts)} pts added to total score (saved with preset).
          </p>
        )}
      </div>
    </div>
  );
}

export default function VaultPage() {
  const { vault, updateVaultField, state } = useApp();
  const vaultScore = Number(state.pageScores?.vault) || 0;

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
      <div className="vault-grid">
        {RESOURCE_ITEMS.map((item) => (
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
              value={vault?.[item.id] ?? ''}
              onChange={(e) => updateVaultField(item.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      <TamingMarksCard />

      {vaultScore > 0 && (
        <div style={{ marginTop: 8, opacity: 0.85, textAlign: 'center' }}>
          Vault page score: <strong>{formatNumber(vaultScore)}</strong>
        </div>
      )}
    </div>
  );
}
