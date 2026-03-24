<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    message: string
    type?: 'info' | 'warning' | 'error'
    duration?: number
    onDismiss: () => void
  }

  let { message, type = 'info', duration = 3000, onDismiss }: Props = $props()

  onMount(() => {
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  })

  const bgColors = {
    info: 'bg-blue-900/90 border-blue-700',
    warning: 'bg-yellow-900/90 border-yellow-700',
    error: 'bg-red-900/90 border-red-700',
  }
</script>

<div
  class="fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm text-white shadow-lg {bgColors[type]}"
  role="alert"
>
  {message}
</div>
