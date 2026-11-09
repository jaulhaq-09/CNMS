import { useState, useEffect } from 'react'
import eventService from '../services/eventService'

// Fetches real Event documents for a list of ids, used by any block
// (like Events Grid) that references real events instead of placeholders.
export function useEventsData(eventIds = []) {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const ids = (eventIds || []).filter(Boolean)
        if (ids.length === 0) {
            setEvents([])
            return
        }

        let cancelled = false
        setLoading(true)

        Promise.all(
            ids.map((id) =>
                eventService.getById(id).then((res) => res.data).catch(() => null)
            )
        ).then((results) => {
            if (!cancelled) {
                setEvents(results.filter(Boolean))
                setLoading(false)
            }
        })

        return () => {
            cancelled = true
        }
    }, [JSON.stringify(eventIds)])

    return { events, loading }
}