# Forward Messages Implementation Plan

## Goal
- Add forward functionality for selected media items in gallery selection mode
- Implement dialog picker UI for selecting destination chat
- Use existing `forwardMessages` adapter method
- Add forward action button to selection header

## Current State Analysis

### Existing Forward Infrastructure
- `src/lib/telegram/adapter.ts`: `forwardMessages(toId: string, fromId: string, msgIds: number[])` interface
- `src/lib/telegram/mock.ts`: Mock implementation with delay
- `src/lib/telegram/mtcute.ts`: Real implementation using mtcute API
- Selection mode already implemented with `selectedMediaIds` store

### Gaps
- No forward action in selection header
- No dialog picker UI for selecting destination
- No store logic for forwarding operations
- No tests for forward functionality

## Implementation Plan

### 1. Add Forward Button to Selection Header
Update `src/components/gallery/GalleryGrid.svelte`:
- Add "Forward" button to selection header actions
- Button enabled when items are selected
- On click: open dialog picker modal

### 2. Create Dialog Picker Component
Create new component `src/components/gallery/DialogPicker.svelte`:
- Modal overlay with dialog list
- Search/filter functionality
- Shows all available dialogs (from dialogs store)
- Selection confirmation
- Loading state while forwarding

### 3. Implement Forward Logic in Gallery Store
Add to `src/stores/gallery.ts`:
- `forwardQueueState` store similar to download/upload queues
- `forwardMessages()` function that:
  - Gets selected media items
  - Extracts message IDs
  - Calls adapter `forwardMessages()`
  - Shows progress/status
- Error handling and cancellation

### 4. Add Forward Progress/Status UI
Add to selection header or separate panel:
- Show "Forwarding X messages to [dialog]" when active
- Progress indicator
- Success/error notifications

### 5. Update Tests
Add to `tests/e2e/short/gallery.spec.ts`:
- Test forward button appears in selection mode
- Test dialog picker opens
- Test forward action with mock adapter

## Technical Details

### Forward Queue State Structure
```typescript
interface ForwardQueueState {
  active: boolean;
  destinationDialogId: string | null;
  destinationDialogTitle: string | null;
  totalMessages: number;
  completedMessages: number;
  error: string | null;
}
```

### Forward Logic
1. User selects media items and clicks "Forward"
2. Dialog picker modal opens
3. User selects destination dialog
4. For each selected media item:
   - Extract message ID from `item.messageId`
   - Call `adapter.forwardMessages(destinationId, currentDialogId, [messageId])`
   - Update progress
5. Show success notification

### UI Integration Points
- Selection header: "Forward" button
- Dialog picker modal: appears when forward button clicked
- Progress indicator: shows during forwarding
- Toast notifications: success/error messages

## Files to Modify/Create
- `src/stores/gallery.ts`: add forward queue state and functions
- `src/components/gallery/GalleryGrid.svelte`: add forward button
- `src/components/gallery/DialogPicker.svelte`: new component
- `src/types/telegram.ts`: add ForwardQueueState type
- `tests/e2e/short/gallery.spec.ts`: add forward tests

## Testing Strategy
- Use mock adapter for predictable forward behavior
- Test selection -> forward -> dialog picker flow
- Test forward progress and completion
- Test error handling

## Risks and Mitigations
- Risk: Forwarding many messages may hit rate limits
  - Mitigation: Implement delay between forwards, batch smaller groups
- Risk: User might forward to same dialog
  - Mitigation: Show warning or disable current dialog in picker
- Risk: Network errors during forwarding
  - Mitigation: Retry logic, clear error states

## Acceptance Criteria
- [ ] Forward button appears in selection header when items selected
- [ ] Clicking forward opens dialog picker modal
- [ ] Dialog picker shows available dialogs with search
- [ ] Selecting destination starts forwarding process
- [ ] Progress is shown during forwarding
- [ ] Success notification appears when complete
- [ ] Errors are handled gracefully
- [ ] Tests pass for forward functionality
- [ ] Type checking passes