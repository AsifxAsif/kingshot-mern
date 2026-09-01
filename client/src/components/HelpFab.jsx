import { useEffect, useState } from 'react';

const SECTIONS = [
  {
    id: 'start',
    title: 'Getting started',
    body: (
      <>
        <p>
          This site is a <strong>Strongest Governor</strong> event calculator for Kingshot. You plan
          upgrades, see resource costs, speedups, and event points, then schedule work across the
          7 event days.
        </p>
        <ol>
          <li>
            <strong>Login / Register</strong> — required to use the calculator and save data. You
            stay logged in until you click Logout.
          </li>
          <li>
            <strong>Vault</strong> — enter everything you own (resources, truegold, dust, speedups,
            shards, widgets, marks, etc.). Other pages read remaining vault after locked upgrades.
          </li>
          <li>
            Open each category page, set <strong>Current → Target</strong>, then check{' '}
            <strong>Upgrade</strong> to lock that plan into scores and vault usage.
          </li>
          <li>
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'presets',
    title: 'Presets & scores',
    body: (
      <>
        <ul>
          <li>
            The <strong>preset menu</strong> (gear icon on mobile, controls in the navbar on
            desktop) switches between saved plans.
          </li>
          <li>
            <strong>New</strong> creates a preset. <strong>Delete</strong> removes the current one
            from the database.
          </li>
          <li>
            <strong>Reset page</strong> clears only the page you are on. <strong>Reset all</strong>{' '}
            clears the whole preset.
          </li>
          <li>
            The navbar LCD shows <strong>page score</strong> and total{' '}
            <strong>Strongest Governor</strong> score from all active, affordable upgrades.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'vault',
    title: 'Vault',
    body: (
      <>
        <p>
          Enter stock amounts using numbers or shorthand (e.g. <code>1.5M</code>, <code>500K</code>
          ). When you activate upgrades on other pages, those costs are subtracted from what later
          pages see as “remaining in vault.”
        </p>
        <p>
          Fill speedup minutes (construction, research, training, general) so pages can estimate
          speedup usage and points.
        </p>
      </>
    ),
  },
  {
    id: 'upgrades',
    title: 'How upgrades work on each page',
    body: (
      <>
        <ul>
          <li>
            <strong>Current level</strong> = what you already have. <strong>Target level</strong> =
            what you want to reach for the event.
          </li>
          <li>
            The card shows estimated <strong>points</strong>, <strong>time</strong>, and{' '}
            <strong>resource costs</strong> vs vault.
          </li>
          <li>
            Check <strong>Upgrade</strong> only when you intend to count that path. Locked paths
            consume vault and add to the page score.
          </li>
          <li>
            If resources are short, the Upgrade control is disabled (dimmed). Adjust vault or lower
            the target.
          </li>
          <li>
            At max level, Upgrade / Speedup controls hide — nothing left to buy.
          </li>
          <li>
            <strong>Show maxed items</strong> (when available) toggles whether fully maxed cards stay
            visible.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'pages',
    title: 'Page guide',
    body: (
      <>
        <ul>
          <li>
            <strong>Buildings</strong> — Town Center, Embassy, etc. Uses bread/wood/stone/iron,
            truegold, tempered truegold. Optional construction speedups. Prerequisites can be
            enforced with the toggle under the buff panel.
          </li>
          <li>
            <strong>War Academy</strong> — research / Truegold tech. Main point source is truegold
            dust. Prerequisites toggle works like Buildings.
          </li>
          <li>
            <strong>Widgets</strong> — hero exclusive gear widgets.
          </li>
          <li>
            <strong>Heroes</strong> — star upgrades with rare / epic / mythic shards.
          </li>
          <li>
            <strong>Hero Gear</strong> — gear levels plus forgehammer / mithril mastery paths.
          </li>
          <li>
            <strong>Gov Gear / Gov Charm</strong> — governor equipment and charms; scores use gear /
            charm score rules from the event.
          </li>
          <li>
            <strong>Pets</strong> — pet levels plus optional <strong>Taming Marks</strong> (advanced
            / common) usage for event points.
          </li>
          <li>
            <strong>Troops</strong> — training and promotion by tier; optional training speedups.
          </li>
          <li>
            <strong>Misc</strong> — Hero Roulette spins and gathering marches. Each march has a{' '}
            <strong>Rounds</strong> control for multiple gathers per day.
          </li>
          <li>
            that day appear. Move steps with <em>All steps → Day</em> or per-step <em>Move to</em>.
            An item shows on only one day once scheduled.
          </li>
          <li>
            <strong>Profile</strong> — account / preset related info.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'prereq',
    title: 'Prerequisites (Buildings & War Academy)',
    body: (
      <>
        <p>
          Some levels need other buildings or research finished first. When the prerequisite check
          is <strong>on</strong>, unmet requirements are listed and can block a sensible plan.
        </p>
        <p>
          Turn the toggle <strong>off</strong> under the speedup / buff card if you only want raw
          cost and points without chasing every dependency while you experiment with levels.
        </p>
        <p>
          Checks use your <strong>selected current levels</strong> on this site, not the live game
          client.
        </p>
      </>
    ),
  },
  {
    id: 'speedups',
    title: 'Speedups',
    body: (
      <>
        <p>
          When you enable speedup on a card, the site prefers the matching type (construction /
          research / training), then falls back to <strong>general</strong> speedups. General usage
          is shared across pages so one page cannot double-count the same general stock.
        </p>
        <p>Speedup minutes also contribute event points where the day rules allow them.</p>
      </>
    ),
  },
  {
    id: 'tips',
    title: 'Tips',
    body: (
      <>
        <ul>
          <li>Update the Vault whenever your real stock changes.</li>
          <li>Only keep Upgrade checked for paths you will actually finish in the event window.</li>
          <li>
            Theme follows your device (light / dark). There is no separate theme toggle in the app.
          </li>
          <li>
            On mobile, use the menu and preset icons in the navbar; tap outside a menu to close it.
          </li>
        </ul>
      </>
    ),
  },
];

export default function HelpFab() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="help-fab-wrap">
        {hint && !open && <div className="help-fab-hint">Help?</div>}
        <button
          type="button"
          className="help-fab"
          aria-label="Help — how to use this site"
          title="Help"
          onMouseEnter={() => setHint(true)}
          onMouseLeave={() => setHint(false)}
          onFocus={() => setHint(true)}
          onBlur={() => setHint(false)}
          onClick={() => {
            setHint(false);
            setOpen(true);
          }}
        >
          ?
        </button>
      </div>

      {open && (
        <div
          className="help-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={() => setOpen(false)}
        >
          <div className="help-modal item-card" onClick={(e) => e.stopPropagation()}>
            <div className="item-card-header help-modal-header">
              <span id="help-modal-title">How to use this site</span>
              <button
                type="button"
                className="preset-btn help-close"
                onClick={() => setOpen(false)}
                aria-label="Close help"
              >
                Close
              </button>
            </div>
            <div className="item-card-body help-modal-body">
              <p className="help-lead">
                Quick guide to the Kingshot <strong>Strongest Governor</strong> calculator — vault,
                upgrades, speedups, prerequisites,.
              </p>
              {SECTIONS.map((s) => (
                <section key={s.id} className="help-section">
                  <h3>{s.title}</h3>
                  <div className="help-section-body">{s.body}</div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
