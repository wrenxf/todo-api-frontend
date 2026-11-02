<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { todoApi } from './api'

const todos = ref([])
const loading = ref(false)
const submitting = ref(false)
const saving = ref(false)
const backendOnline = ref(false)

const stats = reactive({
  total: 0,
  pending: 0,
  completed: 0,
  cancelled: 0,
  completion_rate: 0,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const filters = reactive({ status: '', priority: '', search: '' })

const form = reactive({ title: '', description: '', priority: 'medium', due_date: '' })
const editing = ref(null)
const editForm = reactive({ title: '', description: '', status: 'pending', priority: 'medium', due_date: '' })

const toast = reactive({ visible: false, type: 'success', text: '' })
let toastTimer = null
let searchTimer = null

const statCards = computed(() => [
  { label: '总任务', value: stats.total, hint: '全部记录' },
  { label: '待办', value: stats.pending, hint: '尚未完成' },
  { label: '已完成', value: stats.completed, hint: '已勾选完成' },
  { label: '完成率', value: `${Math.round(stats.completion_rate * 100)}%`, hint: '完成 / 总数' },
])

function showToast(text, type = 'success') {
  toast.text = text
  toast.type = type
  toast.visible = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.visible = false
  }, 2600)
}

function statusText(status) {
  return { pending: '待办', completed: '已完成', cancelled: '已取消' }[status] || status
}

function priorityText(priority) {
  return { high: '高', medium: '中', low: '低' }[priority] || priority
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function isOverdue(todo) {
  if (!todo.due_date || todo.status === 'completed') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${todo.due_date}T00:00:00`) < today
}

async function checkHealth() {
  try {
    await todoApi.health()
    backendOnline.value = true
  } catch (err) {
    backendOnline.value = false
  }
}

async function loadTodos() {
  loading.value = true
  try {
    const data = await todoApi.list({
      page: pagination.page,
      page_size: pagination.pageSize,
      status: filters.status,
      priority: filters.priority,
      search: filters.search.trim(),
    })
    todos.value = data.items || []
    pagination.total = data.total || 0
    pagination.totalPages = data.total_pages || 0
    // 删除最后一页最后一条后，回退到上一页
    if (pagination.page > pagination.totalPages && pagination.totalPages > 0) {
      pagination.page = pagination.totalPages
      await loadTodos()
    }
    backendOnline.value = true
  } catch (err) {
    backendOnline.value = false
    showToast(err.message, 'error')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const data = await todoApi.statistics()
    Object.assign(stats, data)
  } catch (err) {
    backendOnline.value = false
  }
}

async function refresh() {
  await Promise.all([loadTodos(), loadStats()])
}

function applyFilters() {
  pagination.page = 1
  loadTodos()
}

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 350)
}

function changePage(step) {
  const next = pagination.page + step
  if (next < 1 || (pagination.totalPages > 0 && next > pagination.totalPages)) return
  pagination.page = next
  loadTodos()
}

async function createTodo() {
  const title = form.title.trim()
  if (!title) {
    showToast('请填写任务标题', 'error')
    return
  }
  submitting.value = true
  try {
    await todoApi.create({
      title,
      description: form.description.trim(),
      priority: form.priority,
      due_date: form.due_date,
    })
    form.title = ''
    form.description = ''
    form.priority = 'medium'
    form.due_date = ''
    pagination.page = 1
    await refresh()
    showToast('任务创建成功')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    submitting.value = false
  }
}

async function toggleTodo(todo) {
  try {
    await todoApi.toggle(todo.id)
    await refresh()
    showToast(todo.status === 'completed' ? '已恢复为待办' : '已标记完成')
  } catch (err) {
    showToast(err.message, 'error')
  }
}

async function removeTodo(todo) {
  if (!window.confirm(`确定删除「${todo.title}」吗？`)) return
  try {
    await todoApi.remove(todo.id)
    await refresh()
    showToast('任务已删除')
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function openEdit(todo) {
  editing.value = todo
  editForm.title = todo.title
  editForm.description = todo.description || ''
  editForm.status = todo.status
  editForm.priority = todo.priority
  editForm.due_date = todo.due_date || ''
}

function closeEdit() {
  editing.value = null
}

async function saveEdit() {
  if (!editForm.title.trim()) {
    showToast('标题不能为空', 'error')
    return
  }
  saving.value = true
  try {
    await todoApi.update(editing.value.id, {
      title: editForm.title.trim(),
      description: editForm.description,
      status: editForm.status,
      priority: editForm.priority,
      due_date: editForm.due_date,
    })
    closeEdit()
    await refresh()
    showToast('任务已更新')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await checkHealth()
  await refresh()
})

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="logo">✓</span>
        <div>
          <h1>Todo API 控制台</h1>
          <p class="subtitle">Vue 3 + Vite · 与 Go/Gin 后端联调示例</p>
        </div>
      </div>
      <button class="status" :class="backendOnline ? 'online' : 'offline'" @click="checkHealth">
        <span class="dot"></span>
        {{ backendOnline ? '后端已连接' : '后端未连接，点击重试' }}
      </button>
    </header>

    <section class="stats">
      <article v-for="card in statCards" :key="card.label" class="stat">
        <span class="stat-label">{{ card.label }}</span>
        <strong class="stat-value">{{ card.value }}</strong>
        <span class="stat-hint">{{ card.hint }}</span>
      </article>
    </section>

    <main class="layout">
      <aside class="panel">
        <h2>新建任务</h2>
        <form @submit.prevent="createTodo">
          <label>标题 <span class="req">*</span></label>
          <input v-model="form.title" maxlength="200" placeholder="要做什么？" />

          <label>描述</label>
          <textarea v-model="form.description" maxlength="1000" rows="3" placeholder="补充说明（可选）"></textarea>

          <div class="row">
            <div>
              <label>优先级</label>
              <select v-model="form.priority">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label>截止日期</label>
              <input v-model="form.due_date" type="date" />
            </div>
          </div>

          <button class="primary" type="submit" :disabled="submitting">
            {{ submitting ? '提交中…' : '创建任务' }}
          </button>
        </form>
      </aside>

      <section class="content">
        <div class="toolbar">
          <select v-model="filters.status" @change="applyFilters">
            <option value="">全部状态</option>
            <option value="pending">待办</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
          <select v-model="filters.priority" @change="applyFilters">
            <option value="">全部优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <input v-model="filters.search" class="search" placeholder="搜索标题或描述" @input="onSearchInput" />
          <select v-model.number="pagination.pageSize" @change="applyFilters">
            <option :value="5">5 条/页</option>
            <option :value="10">10 条/页</option>
            <option :value="20">20 条/页</option>
          </select>
        </div>

        <div v-if="loading" class="empty">加载中…</div>

        <ul v-else-if="todos.length" class="todo-list">
          <li v-for="todo in todos" :key="todo.id" class="todo" :class="{ done: todo.status === 'completed' }">
            <button class="check" :class="{ checked: todo.status === 'completed' }" @click="toggleTodo(todo)">
              {{ todo.status === 'completed' ? '✓' : '' }}
            </button>

            <div class="todo-body">
              <div class="todo-head">
                <h3>{{ todo.title }}</h3>
                <span class="badge" :class="`p-${todo.priority}`">{{ priorityText(todo.priority) }}</span>
                <span class="badge" :class="`s-${todo.status}`">{{ statusText(todo.status) }}</span>
              </div>
              <p v-if="todo.description" class="desc">{{ todo.description }}</p>
              <div class="meta">
                <span>#{{ todo.id }}</span>
                <span v-if="todo.due_date" :class="{ overdue: isOverdue(todo) }">截止 {{ todo.due_date }}</span>
                <span>创建于 {{ formatTime(todo.created_at) }}</span>
              </div>
            </div>

            <div class="actions">
              <button @click="openEdit(todo)">编辑</button>
              <button class="danger" @click="removeTodo(todo)">删除</button>
            </div>
          </li>
        </ul>

        <div v-else class="empty">
          <p>暂无任务</p>
          <span>在左侧填写并创建第一条任务吧</span>
        </div>

        <footer v-if="pagination.total > 0" class="pager">
          <button :disabled="pagination.page <= 1" @click="changePage(-1)">上一页</button>
          <span>第 {{ pagination.page }} / {{ pagination.totalPages || 1 }} 页 · 共 {{ pagination.total }} 条</span>
          <button :disabled="pagination.page >= pagination.totalPages" @click="changePage(1)">下一页</button>
        </footer>
      </section>
    </main>

    <div v-if="editing" class="modal-mask" @click.self="closeEdit">
      <div class="modal">
        <h2>编辑任务 #{{ editing.id }}</h2>
        <form @submit.prevent="saveEdit">
          <label>标题 <span class="req">*</span></label>
          <input v-model="editForm.title" maxlength="200" />

          <label>描述</label>
          <textarea v-model="editForm.description" maxlength="1000" rows="3"></textarea>

          <div class="row">
            <div>
              <label>状态</label>
              <select v-model="editForm.status">
                <option value="pending">待办</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div>
              <label>优先级</label>
              <select v-model="editForm.priority">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          <label>截止日期</label>
          <input v-model="editForm.due_date" type="date" />

          <div class="modal-actions">
            <button type="button" @click="closeEdit">取消</button>
            <button class="primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </form>
      </div>
    </div>

    <transition name="fade">
      <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>
  </div>
</template>
