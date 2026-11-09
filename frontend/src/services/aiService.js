import api from './api'

// Thin wrapper around the backend's LLM endpoint. The frontend never
// calls an LLM provider directly — it sends the collected, approved
// events to your backend, which handles the prompt, the API key, and
// any moderation before returning a draft.
const aiService = {
  // events: array of approved Event documents (real schema: eventName,
  // cluster/section are plain strings, not populated objects)
  async generateNewsletterDraft(events, { tone = 'formal', departmentName } = {}) {
    const response = await api.post('/api/ai/newsletter/generate', {
      events: events.map((e) => ({
        title: e.eventName,
        description: e.description,
        eventDate: e.eventDate,
        clusterName: e.cluster,
        sectionName: e.section,
      })),
      tone,
      departmentName,
    })
    return response.data // { subject, bodyHtml, bodyText }
  },
}

export default aiService