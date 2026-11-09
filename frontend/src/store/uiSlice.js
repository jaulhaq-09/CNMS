import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    globalLoading: false,
    toast: null, // { type: 'success' | 'error', message: string }
  },
  reducers: {
    setGlobalLoading: (state, action) => {
      state.globalLoading = action.payload
    },
    showToast: (state, action) => {
      state.toast = action.payload
    },
    clearToast: (state) => {
      state.toast = null
    },
  },
})

export const { setGlobalLoading, showToast, clearToast } = uiSlice.actions
export default uiSlice.reducer