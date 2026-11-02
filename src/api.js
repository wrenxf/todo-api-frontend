// 统一的后端请求封装
// 默认 BASE_URL 为空字符串：请求 /api/... 会由 Vite 开发服务器代理到后端，
// 浏览器视角属于同源请求。若想直连后端，把 VITE_API_BASE 设为后端完整地址即可。
const BASE_URL = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

async function request(path, options = {}) {
  const config = { ...options, headers: { ...(options.headers || {}) } }

  if (options.body !== undefined && typeof options.body !== 'string') {
    config.headers['Content-Type'] = 'application/json'
    config.body = JSON.stringify(options.body)
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, config)
  } catch (err) {
    throw new Error(`无法连接后端服务（${BASE_URL || '代理地址'}），请确认后端已启动`)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch (err) {
    // 后端异常时可能返回非 JSON，忽略解析错误，走下面的状态码分支
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.message || `请求失败（HTTP ${response.status}）`
    const detail = payload?.error ? `：${payload.error}` : ''
    throw new Error(message + detail)
  }

  return payload?.data
}

function buildQuery(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      query.set(key, value)
    }
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const todoApi = {
  health: () => request('/api/health'),

  list: (params = {}) => request(`/api/todos${buildQuery(params)}`),

  get: (id) => request(`/api/todos/${id}`),

  create: (payload) => request('/api/todos', { method: 'POST', body: payload }),

  update: (id, payload) => request(`/api/todos/${id}`, { method: 'PUT', body: payload }),

  remove: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),

  toggle: (id) => request(`/api/todos/${id}/toggle`, { method: 'PATCH' }),

  statistics: () => request('/api/todos/statistics'),
}
