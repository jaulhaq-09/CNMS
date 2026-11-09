import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationWidget from '../../components/NotificationWidget'

const mockLoadNotifications = vi.fn()
const mockMarkAsRead = vi.fn()

let mockHookState = {
  notifications: [],
  unreadCount: 0,
  connected: false,
  loadNotifications: mockLoadNotifications,
  markAsRead: mockMarkAsRead,
}

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => mockHookState,
}))

function renderWidget() {
  return render(
    <MemoryRouter>
      <NotificationWidget />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHookState = {
    notifications: [],
    unreadCount: 0,
    connected: false,
    loadNotifications: mockLoadNotifications,
    markAsRead: mockMarkAsRead,
  }
})

describe('NotificationWidget', () => {
  it('calls loadNotifications on mount', () => {
    renderWidget()
    expect(mockLoadNotifications).toHaveBeenCalledWith(1, {})
  });

  it('does not show a badge when there are no unread notifications', () => {
    renderWidget()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  });

  it('shows the unread count badge', () => {
    mockHookState.unreadCount = 3
    renderWidget()
    expect(screen.getByText('3')).toBeInTheDocument()
  });

  it('caps the badge display at 99+', () => {
    mockHookState.unreadCount = 150
    renderWidget()
    expect(screen.getByText('99+')).toBeInTheDocument()
  });

  it('dropdown is closed by default', () => {
    renderWidget()
    expect(screen.queryByText('View all notifications')).not.toBeInTheDocument()
  });

  it('opens the dropdown on click, showing empty state when no notifications', () => {
    renderWidget()
    fireEvent.click(screen.getByTitle('Notifications'))
    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    expect(screen.getByText('View all notifications')).toBeInTheDocument()
  });

  it('shows recent notifications in the dropdown', () => {
    mockHookState.notifications = [
      {
        _id: 'n1',
        type: 'EVENT_APPROVED',
        title: 'Event approved',
        message: 'Your event was approved',
        createdAt: new Date().toISOString(),
        channels: { inApp: { read: false } },
      },
    ]
    mockHookState.unreadCount = 1
    renderWidget()
    fireEvent.click(screen.getByTitle('Notifications'))
    expect(screen.getByText('Event approved')).toBeInTheDocument()
    expect(screen.getByText('Your event was approved')).toBeInTheDocument()
  });

  it('clicking an unread notification calls markAsRead', () => {
    mockHookState.notifications = [
      {
        _id: 'n1',
        type: 'EVENT_APPROVED',
        title: 'Event approved',
        message: 'Your event was approved',
        createdAt: new Date().toISOString(),
        channels: { inApp: { read: false } },
      },
    ]
    renderWidget()
    fireEvent.click(screen.getByTitle('Notifications'))
    fireEvent.click(screen.getByText('Event approved'))
    expect(mockMarkAsRead).toHaveBeenCalledWith('n1')
  });

  it('clicking an already-read notification does not call markAsRead', () => {
    mockHookState.notifications = [
      {
        _id: 'n1',
        type: 'EVENT_APPROVED',
        title: 'Old notification',
        message: 'Already seen',
        createdAt: new Date().toISOString(),
        channels: { inApp: { read: true } },
      },
    ]
    renderWidget()
    fireEvent.click(screen.getByTitle('Notifications'))
    fireEvent.click(screen.getByText('Old notification'))
    expect(mockMarkAsRead).not.toHaveBeenCalled()
  });

  it('only shows the 5 most recent notifications', () => {
    mockHookState.notifications = Array.from({ length: 8 }, (_, i) => ({
      _id: `n${i}`,
      type: 'SYSTEM',
      title: `Notification ${i}`,
      message: 'msg',
      createdAt: new Date().toISOString(),
      channels: { inApp: { read: true } },
    }))
    renderWidget()
    fireEvent.click(screen.getByTitle('Notifications'))
    expect(screen.getByText('Notification 0')).toBeInTheDocument()
    expect(screen.getByText('Notification 4')).toBeInTheDocument()
    expect(screen.queryByText('Notification 5')).not.toBeInTheDocument()
  });
})