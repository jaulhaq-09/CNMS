import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  items: [],
  unreadCount: 0,
  loading: false,
  connected: false,
}

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      // Accepts either a plain array or { items, unreadCount }
      if (Array.isArray(action.payload)) {
        state.items = action.payload
      } else {
        state.items = action.payload.items || []
        if (action.payload.unreadCount !== undefined) {
          state.unreadCount = action.payload.unreadCount
        }
      }
    },
    addNotification: (state, action) => {
      state.items.unshift(action.payload)
      state.unreadCount += 1
    },
    markAsRead: (state, action) => {
      const notif = state.items.find((n) => n._id === action.payload)
      if (notif && notif.channels?.inApp && !notif.channels.inApp.read) {
        notif.channels.inApp.read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
    markAllAsRead: (state) => {
      state.items.forEach((n) => {
        if (n.channels?.inApp) n.channels.inApp.read = true
      })
      state.unreadCount = 0
    },
    removeNotification: (state, action) => {
      state.items = state.items.filter((n) => n._id !== action.payload)
    },
    setConnected: (state, action) => {
      state.connected = action.payload
    },
    clearNotifications: (state) => {
      state.items = []
      state.unreadCount = 0
    },
  },
})

export const {
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  setConnected,
  clearNotifications,
} = notificationSlice.actions

export default notificationSlice.reducer