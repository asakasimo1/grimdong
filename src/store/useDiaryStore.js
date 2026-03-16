import { create } from 'zustand'

export const useDiaryStore = create((set) => ({
  diaryText:        '',
  diaryDate:        '',
  diaryWeather:     null,   // { id, icon, label } | null
  analyzedElements: null,   // { persons:[], places:[], imagePrompt:'', mainPerson:'' }
  generatedImage:   null,   // base64 data URL

  setDiaryText:        (v) => set({ diaryText: v }),
  setDiaryDate:        (v) => set({ diaryDate: v }),
  setDiaryWeather:     (v) => set({ diaryWeather: v }),
  setAnalyzedElements: (v) => set({ analyzedElements: v }),
  setGeneratedImage:   (v) => set({ generatedImage: v }),
  reset: () => set({ diaryText: '', diaryDate: '', diaryWeather: null, analyzedElements: null, generatedImage: null }),
}))
