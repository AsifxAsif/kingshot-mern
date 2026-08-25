import { useState } from 'react';
import { useApp } from '../context/AppContext';
import AssetImg from './AssetImg';
import { asset } from '../utils/images';

/** Collapsible speedup buff card – mirrors original buildings / troops / war-academy HTML */

export function BuildingBuffPanel() {
  const { state, updateSection } = useApp();
  const b = state.settings?.buildingBuffs || {};
  const [open, setOpen] = useState(true);

  const set = (field, value) => {
    updateSection('settings', (prev) => ({
      ...prev,
      buildingBuffs: { ...(prev.buildingBuffs || {}), [field]: value },
    }));
  };

  const speedPct =
    (parseFloat(b.buildingPct) || 0) +
    (parseFloat(b.wolfPet) || 0) +
    (parseFloat(b.kingPos) || 0) +
    (b.groundWorks ? 10 : 0);
  const resourcePct = parseFloat(b.saul) || 0;

  return (
    <div className={`collapsible-section ${open ? '' : 'collapsed'}`}>
      <div className="collapsible-header" onClick={() => setOpen((v) => !v)}>
        <div className="header-content">
          <AssetImg src={asset('building_speedup.webp')} alt="" size={28} />
          <span>BUILDING SPEEDUP BUFFS</span>
        </div>
        <span className="toggle-icon">{open ? '▼' : '▶'}</span>
      </div>
      {open && (
        <div className="collapsible-body">
          <div className="buff-row">
            <div className="buff-field">
              <label>
                <AssetImg src={asset('building_speedup.webp')} size={24} /> Building Speedup (%)
              </label>
              <input
                type="text"
                placeholder="e.g. 121"
                value={b.buildingPct ?? ''}
                onChange={(e) => set('buildingPct', e.target.value)}
              />
              <small>Total building speed bonus %</small>
            </div>
            <div className="buff-field">
              <label>
                <AssetImg src={asset('artifact_icon.webp')} size={24} /> Pan&apos;s Master Artifact
              </label>
              <input
                type="text"
                placeholder="e.g. 3h, 2h 30m"
                value={b.pansArtifact ?? ''}
                onChange={(e) => set('pansArtifact', e.target.value)}
              />
              <small>Fixed hour reduction</small>
            </div>
            <div className="buff-field">
              <label>
                <AssetImg src={asset('wolf_pet_icon.webp')} size={24} /> Wolf Pet
              </label>
              <select value={b.wolfPet ?? '0'} onChange={(e) => set('wolfPet', e.target.value)}>
                <option value="0">No Wolf Pet</option>
                <option value="5">5%</option>
                <option value="7">7%</option>
                <option value="9">9%</option>
                <option value="12">12%</option>
                <option value="15">15%</option>
              </select>
            </div>
            <div className="buff-field">
              <label>
                <AssetImg src={asset('chief_minister.webp')} size={24} /> King: Chief Minister
              </label>
              <select value={b.kingPos ?? '0'} onChange={(e) => set('kingPos', e.target.value)}>
                <option value="0">None</option>
                <option value="10">10%</option>
                <option value="15">15% (w/High King)</option>
              </select>
            </div>
          </div>
          <div className="checkbox-group" style={{ marginBottom: 12 }}>
            <label className="checkbox-label">
              <input
                className="checkbox" type="checkbox"
                checked={!!b.groundWorks}
                onChange={(e) => set('groundWorks', e.target.checked)}
              />
              <AssetImg src={asset('ground_works_icon.webp')} size={24} /> Ground Works (+10%)
            </label>
            <div className="buff-field" style={{ minWidth: 180 }}>
              <label>
                <AssetImg src={asset('saul_resourceful_icon.webp')} size={24} /> Saul&apos;s Resourceful
              </label>
              <select value={b.saul ?? '0'} onChange={(e) => set('saul', e.target.value)}>
                <option value="0">No Saul</option>
                <option value="3">Lv1 (3%)</option>
                <option value="6">Lv2 (6%)</option>
                <option value="9">Lv3 (9%)</option>
                <option value="12">Lv4 (12%)</option>
                <option value="15">Lv5 (15%)</option>
              </select>
              <small>Reduces resource costs</small>
            </div>
            <label className="checkbox-label">
              <input
                className="checkbox" type="checkbox"
                checked={!!b.doubleTime}
                onChange={(e) => set('doubleTime', e.target.checked)}
              />
              <AssetImg src={asset('double_time_icon.webp')} size={24} /> Double Time (-20% time)
            </label>
          </div>
          <div className="buff-total">
            <strong>Total Speedup Buff:</strong> <span>{speedPct}%</span>
            &nbsp;|&nbsp;
            <strong>Resource Cost Reduction:</strong> <span>{resourcePct}%</span>
          </div>
          <div className="checkbox-group" style={{ marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 10 }}>
            <label className="checkbox-label" title="When on, Upgrade is blocked until current-level prerequisites are met">
              <input
                className="checkbox" type="checkbox"
                checked={b.prereqCheck !== false}
                onChange={(e) => set('prereqCheck', e.target.checked)}
              />
              {' '}Enforce prerequisite checks
            </label>
            <small style={{ display: 'block', opacity: 0.75, marginTop: 4 }}>
              Uses each building&apos;s selected <strong>current</strong> level. Turn off to freely estimate points without changing currents.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrainingBuffPanel() {
  const { state, updateSection } = useApp();
  const t = state.settings?.trainingBuffs || {};
  const [open, setOpen] = useState(true);

  const set = (field, value) => {
    updateSection('settings', (prev) => ({
      ...prev,
      trainingBuffs: { ...(prev.trainingBuffs || {}), [field]: value },
    }));
  };

  const total =
    (parseFloat(t.trainingPct) || 0) +
    (parseFloat(t.kingPos) || 0) +
    (t.mobilize ? 30 : 0) +
    (t.kvk ? 25 : 0);

  return (
    <div className={`collapsible-section ${open ? '' : 'collapsed'}`}>
      <div className="collapsible-header" onClick={() => setOpen((v) => !v)}>
        <div className="header-content">
          <AssetImg src={asset('training_speedup.webp')} alt="" size={28} />
          <span>TRAINING SPEEDUP BUFFS</span>
        </div>
        <span className="toggle-icon">{open ? '▼' : '▶'}</span>
      </div>
      {open && (
        <div className="collapsible-body">
          <div className="buff-row">
            <div className="buff-field">
              <label>
                <AssetImg src={asset('training_speedup.webp')} size={24} /> Training Speedup (%)
              </label>
              <input
                type="text"
                placeholder="e.g. 121"
                value={t.trainingPct ?? ''}
                onChange={(e) => set('trainingPct', e.target.value)}
              />
            </div>
            <div className="buff-field">
              <label>
                <AssetImg src={asset('noble_advisor.webp')} size={24} /> King Position
              </label>
              <select value={t.kingPos ?? '0'} onChange={(e) => set('kingPos', e.target.value)}>
                <option value="0">None</option>
                <option value="10">Chief Minister (10%)</option>
                <option value="50">Noble Advisor (50%)</option>
              </select>
            </div>
          </div>
          <div className="checkbox-group" style={{ marginBottom: 12 }}>
            <label className="checkbox-label">
              <input
                className="checkbox" type="checkbox"
                checked={!!t.mobilize}
                onChange={(e) => set('mobilize', e.target.checked)}
              />
              <AssetImg src={asset('mobilize_icon.webp')} size={24} /> Mobilize (+30%)
            </label>
            <label className="checkbox-label">
              <input
                className="checkbox" type="checkbox"
                checked={!!t.kvk}
                onChange={(e) => set('kvk', e.target.checked)}
              />
              <AssetImg src={asset('kvk_icon.webp')} size={24} /> KvK Bonus (+25%)
            </label>
          </div>
          <div className="buff-total">
            <strong>Total Speedup Buff:</strong> <span>{total}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResearchBuffPanel() {
  const { state, updateSection } = useApp();
  const r = state.settings?.researchBuffs || {};
  const [open, setOpen] = useState(true);

  const set = (field, value) => {
    updateSection('settings', (prev) => ({
      ...prev,
      researchBuffs: { ...(prev.researchBuffs || {}), [field]: value },
    }));
  };

  const total =
    (parseFloat(r.researchPct) || 0) +
    (parseFloat(r.kingPos) || 0) +
    (r.freshIdeas ? 10 : 0);

  return (
    <div className={`collapsible-section ${open ? '' : 'collapsed'}`}>
      <div className="collapsible-header" onClick={() => setOpen((v) => !v)}>
        <div className="header-content">
          <AssetImg src={asset('research_speedup.webp')} alt="" size={28} />
          <span>RESEARCH SPEEDUP BUFFS</span>
        </div>
        <span className="toggle-icon">{open ? '▼' : '▶'}</span>
      </div>
      {open && (
        <div className="collapsible-body">
          <div className="buff-row">
            <div className="buff-field">
              <label>
                <AssetImg src={asset('research_speedup.webp')} size={24} /> Research Speedup (%)
              </label>
              <input
                type="text"
                placeholder="e.g. 121"
                value={r.researchPct ?? ''}
                onChange={(e) => set('researchPct', e.target.value)}
              />
            </div>
            <div className="buff-field">
              <label>
                <AssetImg src={asset('chief_minister.webp')} size={24} /> King: Chief Minister
              </label>
              <select value={r.kingPos ?? '0'} onChange={(e) => set('kingPos', e.target.value)}>
                <option value="0">None</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
              </select>
            </div>
          </div>
          <div className="checkbox-group" style={{ marginBottom: 12 }}>
            <label className="checkbox-label">
              <input
                className="checkbox" type="checkbox"
                checked={!!r.freshIdeas}
                onChange={(e) => set('freshIdeas', e.target.checked)}
              />
              <AssetImg src={asset('fresh_ideas_icon.webp')} size={24} /> Fresh Ideas (+10%)
            </label>
          </div>
          <div className="buff-total">
            <strong>Total Speedup Buff:</strong> <span>{total}%</span>
          </div>
          <div className="checkbox-group" style={{ marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 10 }}>
            <label className="checkbox-label" title="When on, Upgrade is blocked until current-level prerequisites are met">
              <input
                className="checkbox" type="checkbox"
                checked={r.prereqCheck !== false}
                onChange={(e) => set('prereqCheck', e.target.checked)}
              />
              {' '}Enforce prerequisite checks
            </label>
            <small style={{ display: 'block', opacity: 0.75, marginTop: 4 }}>
              Uses each tech/building&apos;s selected <strong>current</strong> level. Turn off to freely estimate points without changing currents.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
