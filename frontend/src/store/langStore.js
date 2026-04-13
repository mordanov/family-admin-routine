import { create } from 'zustand'

export const useLangStore = create((set) => ({
  lang: localStorage.getItem('admin_routine_lang') || 'en',
  setLang: (lang) => {
    localStorage.setItem('admin_routine_lang', lang)
    set({ lang })
  },
}))
