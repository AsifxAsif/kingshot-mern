import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GLOBAL_SECTIONS = [
  {
    id: 'start',
    title: 'Getting started',
    body: (
      <>
        <p>
          Plan your event upgrades, see costs vs your vault, and track points for the selected
          event.
        </p>
        <ol>
          <li>
            <strong>Login or Register</strong> — required to use the calculator. Registration needs
            a valid Player UID (Governor ID), email, and password.
          </li>
          <li>
            <strong>Vault</strong> — enter what you own (resources, speedups, shards, etc.).
          </li>
          <li>
            Open a category page, set <strong>Current → Target</strong>, then check{' '}
            <strong>Upgrade</strong> when you want that plan locked into points and vault usage.
          </li>
          <li>
            Switch <strong>events</strong> in the side panel — your levels stay shared; only point
            rates change.
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
            Use the <strong>preset menu</strong> to switch, create, rename, or delete saved plans.
          </li>
          <li>
            <strong>Reset page</strong> clears only the current page. <strong>Reset all</strong>{' '}
            clears the whole preset.
          </li>
          <li>
            The navbar shows this page’s points and your <strong>total event score</strong> from
            locked, affordable upgrades.
          </li>
          <li>
            Changes save automatically while you are logged in.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'upgrades',
    title: 'Upgrades & locked buttons',
    body: (
      <>
        <ul>
          <li>
            <strong>Current</strong> = what you already have. <strong>Target</strong> = what you
            want for the event.
          </li>
          <li>
            Check <strong>Upgrade</strong> only when you intend to count that path. Locked paths
            use vault stock and add to the page score.
          </li>
          <li>
            If <strong>Upgrade</strong> is dimmed or the status is red, read the reason under the
            card — usually missing vault items, unmet prerequisites, or mastery requirements.
          </li>
          <li>
            <strong>Show maxed items</strong> hides or shows cards that are already at max.
          </li>
          <li>
            <strong>Prerequisite check</strong> (where shown) enforces game unlock rules. Turn it
            off only if you want to explore costs without those locks.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'events',
    title: 'Events',
    body: (
      <>
        <p>
          Pick Strongest Governor, KvK, or other events from the event panel. Your upgrade levels
          and vault are <strong>shared</strong> across events. Point values update to that event’s
          rates — you do not need to re-enter every page after switching (scores refresh
          automatically).
        </p>
      </>
    ),
  },
  {
    id: 'profile',
    title: 'Profile',
    body: (
      <>
        <p>
          Profile shows live player info linked to the Governor ID you registered with: power,
          kills, alliance, kingdom ranks, and arena heroes. Use <strong>Refresh</strong> when you
          want newer data (there is a cooldown between refreshes).
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Account tips',
    body: (
      <>
        <ul>
          <li>Email and Player UID must be unique. Usernames may be shared.</li>
          <li>
            If several people use the same username, sign in with your <strong>email</strong>.
          </li>
          <li>Stay logged in until you press Logout.</li>
        </ul>
      </>
    ),
  },
];

const PAGE_HELP = {
  '/': {
    title: 'This page: Vault',
    body: (
      <>
        <p>
          Enter stock for every item you own. Other pages subtract locked upgrade costs from these
          amounts when showing “remaining.”
        </p>
        <ul>
          <li>Use plain numbers or shorthand like <code>1.5M</code> / <code>500K</code>.</li>
          <li>Include speedups so time and speedup points estimate correctly elsewhere.</li>
          <li>Some events add extra vault fields — they appear when that event is selected.</li>
        </ul>
      </>
    ),
  },
  '/buildings': {
    title: 'This page: Buildings',
    body: (
      <ul>
        <li>Set building current → target levels for the event.</li>
        <li>Costs use basic resources and truegold where applicable.</li>
        <li>Prerequisites can block higher buildings until lower ones catch up.</li>
      </ul>
    ),
  },
  '/war-academy': {
    title: 'This page: War Academy',
    body: (
      <ul>
        <li>Research / academy paths — often truegold dust heavy.</li>
        <li>Use prerequisite check so locked techs stay blocked until requirements are met.</li>
      </ul>
    ),
  },
  '/masters': {
    title: 'This page: Masters',
    body: (
      <ul>
        <li>Select one master at a time from the input cards.</li>
        <li>Affinity levels and skills have unlock requirements — read the lock reasons on the card.</li>
        <li>Skill upgrades start at level 1 when unlocked; raise target to plan higher ranks.</li>
      </ul>
    ),
  },
  '/widgets': {
    title: 'This page: Widgets',
    body: (
      <ul>
        <li>Hero exclusive widgets — set levels and lock upgrades you plan to finish.</li>
      </ul>
    ),
  },
  '/heroes': {
    title: 'This page: Heroes',
    body: (
      <ul>
        <li>Star / flower upgrades use shards from the vault.</li>
        <li>Pick generation filter, then current → target stars.</li>
        <li>Upgrade stays locked if shards are short or the target is invalid.</li>
      </ul>
    ),
  },
  '/hero-gear': {
    title: 'This page: Hero Gear',
    body: (
      <ul>
        <li>Gear levels need materials (e.g. mithril / mythic gear) from the vault.</li>
        <li>
          High levels need <strong>mastery</strong> — enter that gear’s mastery on the card. The
          field shows how much mastery you need.
        </li>
        <li>Mastery checks are always on for this page.</li>
      </ul>
    ),
  },
  '/gov-gear': {
    title: 'This page: Governor Gear',
    body: (
      <ul>
        <li>Plan governor equipment upgrades and lock the ones you will complete.</li>
      </ul>
    ),
  },
  '/gov-charm': {
    title: 'This page: Governor Charm',
    body: (
      <ul>
        <li>Charm levels and costs follow the same current → target → Upgrade pattern.</li>
      </ul>
    ),
  },
  '/pets': {
    title: 'This page: Pets',
    body: (
      <ul>
        <li>Pet levels plus optional taming marks for event points.</li>
      </ul>
    ),
  },
  '/troops': {
    title: 'This page: Troops',
    body: (
      <ul>
        <li>Training and promotion by tier. Optional training speedups affect estimates.</li>
      </ul>
    ),
  },
  '/misc': {
    title: 'This page: Misc',
    body: (
      <ul>
        <li>Hero Roulette, gathering settings, and other event extras.</li>
        <li>Gathering: marches, Bison Grip uses, resource type, and node level.</li>
      </ul>
    ),
  },
  '/profile': {
    title: 'This page: Profile',
    body: (
      <ul>
        <li>Live stats for the Governor ID on your account.</li>
        <li>Town Center shows TG labels (e.g. TG5) when level is past the early ranks.</li>
        <li>Refresh respects a cooldown so data is not requested too often.</li>
      </ul>
    ),
  },
};

export default function HelpFab() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const location = useLocation();
  const pageHelp = PAGE_HELP[location.pathname] || null;

  useEffect(() => {
    if (open) return undefined;
    const t = setTimeout(() => setHint(true), 1200);
    const t2 = setTimeout(() => setHint(false), 5000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [open, location.pathname]);

  return (
    <div className="help-fab-wrap">
      {hint && !open && <div className="help-fab-hint">Help?</div>}
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        title="Help"
      >
        ?
      </button>
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
                Quick guide for the event calculator. Scroll for general tips
                {pageHelp ? ' and help for the page you are on' : ''}.
              </p>

              {pageHelp && (
                <section className="help-section help-section-page">
                  <h3>
                    <span className="help-page-badge">Page-specific</span> {pageHelp.title}
                  </h3>
                  <div className="help-section-body">{pageHelp.body}</div>
                </section>
              )}

              {GLOBAL_SECTIONS.map((s) => (
                <section key={s.id} className="help-section">
                  <h3>{s.title}</h3>
                  <div className="help-section-body">{s.body}</div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
