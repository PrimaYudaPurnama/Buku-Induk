import { useThemeStore } from '../stores/useThemeStore';

/**
 * Hook untuk mendapatkan theme-aware classes
 */
export const useTheme = () => {
  const theme = useThemeStore((state) => state.theme);
  
  return {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    // Background classes
    bgGradient: theme === 'dark' 
      ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900'
      : 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100',
    bgCard: theme === 'dark'
      ? 'bg-slate-900/80 backdrop-blur-xl border-blue-900/50'
      : 'bg-white/90 backdrop-blur-xl border-slate-200',
    bgMain: theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50',
    // Text classes
    textPrimary: theme === 'dark' ? 'text-white' : 'text-slate-900',
    textSecondary: theme === 'dark' ? 'text-slate-400' : 'text-slate-600',
    textTertiary: theme === 'dark' ? 'text-slate-300' : 'text-slate-700',
    // Border classes
    borderPrimary: theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200',
    borderSecondary: theme === 'dark' ? 'border-blue-900/50' : 'border-blue-200',
    // Button classes
    buttonBg: theme === 'dark'
      ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50 hover:bg-slate-700/70'
      : 'bg-white/70 backdrop-blur-sm border-slate-300/50 hover:bg-slate-100/90',
  };
};
