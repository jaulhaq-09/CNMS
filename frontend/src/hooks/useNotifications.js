import { useState, useEffect, useCallback } from 'react'
import { connectSocket } from '../services/socket'
import notificationService from '../services/notificationService'
import authService from '../services/authService'

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)

  // Reuses the single shared socket connection from services/socket.js
  // instead of opening a second, independent one — connectSocket() is a
  // no-op if a connection already exists (e.g. from a previous mount).
  useEffect(() => {
    const token = authService.getToken()
    if (!token) return

    const user = authService.getUser()
    const socket = connectSocket(token, user?._id)

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('notification:new', () => {
      loadNotifications()
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
    })

    if (socket.connected) setConnected(true)

    return () => {
      socket.off('connect')
      socket.off('notification:new')
      socket.off('disconnect')
      socket.off('connect_error')
    }
  }, [])

  const loadNotifications = useCallback(async (page = 1, filters = {}) => {
    try {
      setLoading(true)
      const response = await notificationService.getAll(page, 20, filters)
      setNotifications(response.data)
      setUnreadCount(response.pagination.unreadCount)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId)
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === notificationId
            ? {
              ...notif,
              channels: {
                ...notif.channels,
                inApp: { ...notif.channels?.inApp, read: true },
              },
            }
            : notif
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          channels: {
            ...notif.channels,
            inApp: { ...notif.channels?.inApp, read: true },
          },
        }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }, [])

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await notificationService.delete(notificationId)
      setNotifications((prev) => prev.filter((notif) => notif._id !== notificationId))
      loadNotifications(1, {})
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }, [loadNotifications])

  const deleteAll = useCallback(async () => {
    try {
      await notificationService.deleteAll()
      setNotifications([])
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
    }
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    connected,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAll,
  }
}