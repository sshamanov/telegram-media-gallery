<script lang="ts">
  import { formatDateTime, formatDuration, formatSize, mediaKindLabel } from '../../lib/media'
  import type { MediaItem } from '../../types/telegram'

  export let item: MediaItem | null
  export let open = false

  function hasDimensions(value: MediaItem): boolean {
    return value.width > 0 && value.height > 0
  }
</script>

{#if item && open}
  <aside class="panel info-panel">
    <div class="handle"></div>
    <h3>{item.filename}</h3>
    <dl>
      <div><dt>Kind</dt><dd>{mediaKindLabel(item)}</dd></div>
      <div><dt>Size</dt><dd>{formatSize(item.size)}</dd></div>
      {#if item.durationSeconds}
        <div><dt>Duration</dt><dd>{formatDuration(item.durationSeconds)}</dd></div>
      {/if}
      {#if hasDimensions(item)}
        <div><dt>Dimensions</dt><dd>{item.width} x {item.height}</dd></div>
      {/if}
      <div><dt>Date</dt><dd>{formatDateTime(item.date).date}</dd></div>
      <div><dt>Time</dt><dd>{formatDateTime(item.date).time}</dd></div>
      <div><dt>MIME</dt><dd>{item.mimeType}</dd></div>
      <div><dt>From</dt><dd>{item.sender ?? 'Unknown'}</dd></div>
      {#if item.caption}
        <div class="stacked"><dt>Caption</dt><dd>{item.caption}</dd></div>
      {/if}
      <div><dt>Message ID</dt><dd>{item.messageId}</dd></div>
    </dl>
  </aside>
{/if}

<style>
  .info-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2000;
    padding: 18px 20px calc(env(safe-area-inset-bottom, 0px) + 24px);
    background: rgba(14, 14, 14, 0.97);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    pointer-events: auto;
    max-height: 55vh;
    overflow-y: auto;
  }

  .handle {
    width: 72px;
    height: 4px;
    margin: 0 auto 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.15);
  }

  h3 {
    margin: 0 0 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dl {
    margin: 0;
    display: grid;
    gap: 12px;
  }

  div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .stacked {
    display: grid;
  }

  dt {
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    text-align: right;
    word-break: break-word;
  }

  .stacked dd {
    text-align: left;
  }
</style>
