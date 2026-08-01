import { useApp } from '../context/AppContext';
import { RESOURCE_ITEMS } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import { resourceImg, asset } from '../utils/images';

export default function VaultPage() {
  const { vault, updateVaultField } = useApp();

  return (
    <div className="vault-section">
      <h2>
        <AssetImg src={asset('vault_icon.webp')} size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        RESOURCE VAULT
      </h2>
      <p className="hint">
        Inventory saved to MongoDB. Global score comes from <strong>Active</strong> upgrades on other pages.
      </p>
      <div className="vault-grid">
        {RESOURCE_ITEMS.map((item) => (
          <div className="vault-item" key={item.id}>
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
    </div>
  );
}
