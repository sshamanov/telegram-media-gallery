<script lang="ts">
  import { authors, selectedAuthors } from '../../stores/gallery'
  import { tooltip } from '../../lib/dom/tooltips'

  function toggleAuthor(author: string): void {
    $selectedAuthors = $selectedAuthors.includes(author)
      ? $selectedAuthors.filter((a: string) => a !== author)
      : [...$selectedAuthors, author]
  }
</script>

<div class="author-filter-bar" data-testid="author-filter-bar">
  {#if $authors.length === 0}
    <span class="author-filter-empty muted">No authors found</span>
  {:else}
    {#each $authors as author (author)}
      <button
        class:active={$selectedAuthors.includes(author)}
        class="author-filter-pill"
        type="button"
        on:click={() => toggleAuthor(author)}
        data-testid={`author-filter-${author}`}
        use:tooltip={{ text: author }}
      >
        {author}
      </button>
    {/each}
  {/if}
</div>

<style>
  .author-filter-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .author-filter-empty {
    font-size: 0.9rem;
    padding: 10px 14px;
  }

  .author-filter-pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 10px 14px;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .author-filter-pill.active {
    color: var(--text-primary);
    background: rgba(0, 136, 204, 0.24);
    border-color: rgba(0, 136, 204, 0.45);
  }

  .author-filter-pill:hover {
    background: rgba(255, 255, 255, 0.08);
  }
</style>