import { create } from 'zustand'

const useStore = create((set) => ({
  selectedSport: 'hockey',
  setSport: (sport) => set({ selectedSport: sport }),

  theme: 'light',
}))

export default useStore
