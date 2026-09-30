import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type Theme = 'dark' | 'light';
const Context = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: 'dark', setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, update] = useState<Theme>('dark');
  useEffect(() => { try { const saved = localStorage.getItem('ecom:theme'); if (saved === 'light' || saved === 'dark') update(saved); } catch {} }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);
  function setTheme(next: Theme) { update(next); try { localStorage.setItem('ecom:theme', next); } catch {} }
  return <Context.Provider value={{ theme, setTheme }}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
