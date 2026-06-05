import { create } from 'zustand'

const useStore = create((set) => ({
  selectedSport: 'hockey',
  setSport: (sport) => set({ selectedSport: sport }),

  theme: localStorage.getItem('theme') || 'dark',
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      return { theme: next }
    }),
}))

export default useStore
