import { NavLink } from 'react-router-dom';
import { haptics } from './haptics';
import { appTabs } from './screens';

/** The app's tabs, along the bottom like any iPhone app */
const TabBar = () => (
  <nav
    aria-label="Huvudmeny"
    className="ca-app-tabbar relative z-[1200] shrink-0 border-t border-[hsl(var(--ca-line-strong))]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
  >
    <ul className="flex h-[54px]">
      {appTabs().map(({ to, label, icon: Icon, prominent }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            // Tapping the tab you are on goes back to its top, as in iOS
            onClick={() => {
              // A tap under the finger in app versions with haptics (1.3 on)
              haptics.selection();
              if (window.location.pathname === to) window.dispatchEvent(new Event('ca-tab-top'));
            }}
            className={({ isActive }) =>
              `flex h-full flex-col items-center justify-center gap-[3px] text-[10px] font-medium transition-colors ${
                isActive ? 'text-[hsl(var(--ca-red))]' : 'text-[hsl(var(--ca-text-3))]'
              }`
            }
          >
            {({ isActive }) => (
              prominent ? (
                <>
                  {/* Tinted while elsewhere, filled while open, so it never looks like the tab you are on */}
                  <span className={`flex h-[30px] w-[42px] items-center justify-center rounded-[10px] transition-colors ${isActive ? 'bg-[hsl(var(--ca-red))] text-white' : 'bg-[hsl(var(--ca-red)/0.16)] text-[hsl(var(--ca-red))]'}`}>
                    <Icon className="h-[19px] w-[19px]" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className={isActive ? '' : 'text-[hsl(var(--ca-text-2))]'}>{label}</span>
                </>
              ) : (
                <>
                  <Icon className="h-[23px] w-[23px]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  <span>{label}</span>
                </>
              )
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default TabBar;
