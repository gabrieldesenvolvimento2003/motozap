import { createContext, useContext, useState, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

export const palette = {
  light: {
    bg: '#FAFAFA',
    surface: '#FFF',
    surfaceAlt: '#F5F5F5',
    border: '#EEE',
    text: '#1A1A1A',
    textMuted: '#666',
    textSubtle: '#888',
    accent: '#FF6B00',
    accentText: '#FFF',
    shadow: 'rgba(0,0,0,0.05)',
    chip: '#F0F0F0',
    pagBg: '#F0F8F0',
    pagText: '#2E7D32',
    emptyText: '#666',
    divider: '#F0F0F0',
  },
  dark: {
    bg: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceAlt: '#252525',
    border: '#2A2A2A',
    text: '#FAFAFA',
    textMuted: '#888',
    textSubtle: '#666',
    accent: '#FF6B00',
    accentText: '#FFF',
    shadow: 'rgba(0,0,0,0.3)',
    chip: '#2A2A2A',
    pagBg: '#1B3A1B',
    pagText: '#81C784',
    emptyText: '#888',
    divider: '#252525',
  },
};

type ThemeCtx = {
  mode: ThemeMode;
  toggle: () => void;
  colors: typeof palette.light;
};

const ThemeContext = createContext<ThemeCtx>({
  mode: 'light',
  toggle: () => {},
  colors: palette.light,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  const colors = palette[mode];
  return (
    <ThemeContext.Provider value={{ mode, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);