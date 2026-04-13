<script lang="ts">
  import SettingsPanel from './SettingsPanel.svelte'
  import { navigateToDialogList } from '../../lib/routing'

  function goBack(): void {
    navigateToDialogList()
  }
</script>

<section class="settings-screen">
  <header class="settings-header">
    <button class="button ghost" type="button" on:click={goBack} aria-label="Back to dialogs">← Back</button>
    <h1>Settings</h1>
  </header>

  <div class="settings-content">
    <SettingsPanel />
  </div>
</section>

<style>
  .settings-screen {
    max-width: var(--content-width);
    margin: 0 auto;
    padding: 20px;
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .settings-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  .settings-content {
    background: var(--bg-surface);
    border-radius: 20px;
    border: 2px solid var(--border-focus);
    overflow: hidden;
    padding: 20px;
  }

  @media (max-width: 768px) {
    .settings-content {
      padding: 16px;
      border-radius: 16px;
    }
  }

  @media (max-width: 768px) {
    .settings-screen {
      padding: 16px;
    }
    
    .settings-header {
      margin-bottom: 20px;
    }
  }
</style>