import { create } from 'zustand'

export const useTransformStore = create((set) => ({
  isOpen: false,
  canvasDataUrl: null,
  mode: 'draw',
  style: '지브리',
  transforming: false,
  transformedImg: null,
  onUseTransformed: null,

  open: (canvasDataUrl, mode, onUseTransformed) =>
    set({ isOpen: true, canvasDataUrl, mode, onUseTransformed, transformedImg: null, transforming: false }),
  close: () => set({ isOpen: false, transformedImg: null, transforming: false }),
  setStyle: (style) => set({ style }),
  setTransforming: (v) => set({ transforming: v }),
  setTransformedImg: (url) => set({ transformedImg: url }),
}))
