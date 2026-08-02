import { useApp } from '../context/AppContext';
import { RESOURCE_ITEMS } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import { resourceImg, asset } from '../utils/images';

export default function VaultPage() {
  const { vault, remainingVault, globalScore, updateVaultField } = useApp();

  return (
    <div className="vault-section">
      <h2>
        <AssetImg src={asset('vault_icon.webp')} size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        RESOURCE VAULT
      </h2>
      <p className="hint">
        Enter your total available resources here. The <strong>remaining</strong> column shows what's left after locked upgrades from all pages.
        <br />
        Supports K, M, B (e.g., 1.5M, 2.3B, 470.29M) and time formats (e.g., 2d 14h 35m).
      </p>
      <div className="vault-grid">
        {RESOURCE_ITEMS.map((item) => {
          const totalValue = vault?.[item.id] ?? '';
          const remainingValue = remainingVault?.[item.id] ?? '';
          const isSpeedup = item.id.includes('speedup');
          
          return (
            <div className="vault-item" key={item.id}>
              <div className="vault-label">
                <AssetImg src={resourceImg(item.id)} size={36} />
                <label htmlFor={item.id}>{item.label}</label>
              </div>
              <input
                id={item.id}
                type="text"
                placeholder={item.placeholder}
                value={totalValue}
                onChange={(e) => updateVaultField(item.id, e.target.value)}
              />
              {remainingValue !== '' && totalValue !== '' && (
                <div style={{ 
                  marginTop: 4, 
                  fontSize: '0.7rem', 
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  borderTop: '1px solid rgba(0,0,0,0.05)',
                  paddingTop: 4
                }}>
                  <span style={{ fontWeight: 700 }}>Remaining:</span>{' '}
                  <span style={{ color: parseFloat(remainingValue) > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {remainingValue}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="totals-bar">
        <strong>Strongest Governor Total Score:</strong>{' '}
        <span style={{ color: 'var(--lcd-glow, #4af205)', fontWeight: 700 }}>
          {globalScore.toLocaleString()}
        </span>
      </div>
    </div>
  );
}