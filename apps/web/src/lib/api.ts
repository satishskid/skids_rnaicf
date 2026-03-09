const API_BASE = 'https://skids-api.satish-9f4.workers.dev'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiCall<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || `API error: ${res.status}`)
  }

  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

// ---- Auth endpoints ----

export async function signUp(name: string, email: string, password: string) {
  return apiCall<{ token: string; user: { id: string; name: string; email: string } }>(
    '/api/auth/sign-up/email',
    {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    },
  )
}

export async function signIn(email: string, password: string) {
  return apiCall<{ token: string; user: { id: string; name: string; email: string; role?: string } }>(
    '/api/auth/sign-in/email',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  )
}

export async function healthCheck() {
  return apiCall<{ status: string }>('/api/health')
}

// ---- Campaign endpoints ----

export async function getCampaigns() {
  return apiCall<{ campaigns: unknown[] }>('/api/campaigns')
}

export async function createCampaign(data: Record<string, unknown>) {
  return apiCall('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCampaignByCode(code: string) {
  return apiCall<{ campaign: unknown }>(`/api/campaigns/${code}`)
}

// ---- Children endpoints ----

export async function getChildren(campaignCode: string) {
  return apiCall<{ children: unknown[] }>(`/api/children?campaign=${campaignCode}`)
}

export async function createChild(data: Record<string, unknown>) {
  return apiCall('/api/children', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ---- Observation endpoints ----

export async function getObservations(campaignCode: string) {
  return apiCall<{ observations: unknown[] }>(`/api/observations?campaign=${campaignCode}`)
}

export async function createObservation(data: Record<string, unknown>) {
  return apiCall('/api/observations', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ---- Review endpoints ----

export async function getReviews(campaignCode: string) {
  return apiCall<{ reviews: unknown[] }>(`/api/reviews?campaign=${campaignCode}`)
}

export async function createReview(data: Record<string, unknown>) {
  return apiCall('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
