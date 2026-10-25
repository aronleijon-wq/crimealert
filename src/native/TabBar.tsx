import { NavLink } from 'react-router-dom';
import { TABS } from './screens';

/** The app's tabs, along the bottom like any iPhone app */
const TabBar = () => (
  <nav
    aria-label="Huvudmeny"
    className="ca-app-tabbar relative z-[1200] shrink-0 border-t border-[hsl(var(--ca-line-strong))]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
  >
    <ul className="flex h-[54px]">
      {TABS.map(({ to, label, icon: Icon }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            // Tapping the tab you are on goes back to its top, as in iOS
            onClick={() => { if (window.location.pathname === to) window.dispatchEvent(new Event('ca-tab-top')); }}
            className={({ isActive }) =>
              `flex h-full flex-col items-center justify-center gap-[3px] text-[10px] font-medium transition-colors ${
                isActive ? 'text-[hsl(var(--ca-red))]' : 'text-[hsl(var(--ca-text-3))]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-[23px] w-[23px]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default TabBar;
