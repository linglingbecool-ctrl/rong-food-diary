import { Heart, Home, Map, PlusCircle, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

type NavItem = {
  label: string;
  to: string;
  icon: typeof Home;
  primary?: boolean;
};

const navItems: NavItem[] = [
  { label: "首页", to: "/home", icon: Home },
  { label: "地图", to: "/map", icon: Map },
  { label: "记录", to: "/visits/new", icon: PlusCircle, primary: true },
  { label: "想吃", to: "/wishlist", icon: Heart },
  { label: "我的", to: "/settings", icon: UserRound },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-20 h-nav w-full max-w-app -translate-x-1/2 border-t border-line/80 bg-cream/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-soft backdrop-blur"
      aria-label="底部导航"
    >
      <div className="grid grid-cols-5 items-end gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition",
                  item.primary ? "relative -mt-5" : "",
                  isActive ? "text-ink" : "text-muted",
                ].join(" ")
              }
              aria-label={item.label}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      "grid place-items-center transition",
                      item.primary
                        ? "h-12 w-12 rounded-full bg-ink text-white shadow-soft"
                        : "h-7 w-7",
                      isActive && !item.primary ? "rounded-full bg-orange/15 text-orange" : "",
                    ].join(" ")}
                  >
                    <Icon size={item.primary ? 24 : 20} strokeWidth={2.2} />
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
