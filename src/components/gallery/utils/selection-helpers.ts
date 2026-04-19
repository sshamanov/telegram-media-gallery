export interface LongPressHandlerOptions {
  onLongPress: () => void
  delayMs?: number
}

export interface LongPressHandler {
  onTouchStart: () => void
  onTouchEnd: () => void
  onTouchCancel: () => void
}

export function createLongPressHandler(options: LongPressHandlerOptions): LongPressHandler {
  const { onLongPress, delayMs = 500 } = options
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let longPressTriggered = false

  const onTouchStart = () => {
    longPressTriggered = false
    longPressTimer = setTimeout(() => {
      longPressTriggered = true
      onLongPress()
    }, delayMs)
  }

  const onTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    if (longPressTriggered) {
      longPressTriggered = false
    }
  }

  const onTouchCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    longPressTriggered = false
  }

  return { onTouchStart, onTouchEnd, onTouchCancel }
}

export function getSelectionCountText(selectedCount: number, visibleCount: number): string {
  return `${selectedCount} of ${visibleCount} visible items selected`
}

export function canPerformBulkAction(
  selectedCount: number,
  isOffline: boolean,
  action: 'download' | 'forward' | 'share' | 'copy'
): { canPerform: boolean; disabledReason?: string } {
  if (selectedCount === 0) {
    return { canPerform: false, disabledReason: 'No items selected' }
  }

  if (isOffline) {
    switch (action) {
      case 'download':
        return { 
          canPerform: false, 
          disabledReason: 'Downloads are unavailable offline unless the file is already open in the viewer cache.' 
        }
      case 'forward':
        return { 
          canPerform: false, 
          disabledReason: 'Forwarding is unavailable offline until Telegram connectivity returns.' 
        }
      case 'share':
        return { 
          canPerform: false, 
          disabledReason: 'Sharing is unavailable offline because uncached media cannot be fetched.' 
        }
      case 'copy':
        return { canPerform: true } // Copy can work offline if URLs are cached
    }
  }

  return { canPerform: true }
}

export function getBulkActionButtonTitle(
  selectedCount: number,
  isOffline: boolean,
  action: 'download' | 'forward' | 'share' | 'copy'
): string | undefined {
  const { disabledReason } = canPerformBulkAction(selectedCount, isOffline, action)
  return disabledReason
}