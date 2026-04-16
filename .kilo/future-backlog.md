# Future Backlog

## Backlog Items (Organized by Importance)

### P0 - Critical / Blocking Issues
| ID | Title | Description | Priority | Complexity | Dependencies | Status |
|----|-------|-------------|----------|------------|--------------|--------|
| FB001 | Fix thumbnail download inefficiency | Thumbnails download full-size media when `getThumbnail('s')` returns null, wasting bandwidth and slowing loading | P0 | M | None | completed |
| FB008 | Investigate download speed regression | Check if recent changes affected Telegram API download performance; compare with earlier git versions | P0 | M | None | planned |

### P1 - High Priority Improvements  
| ID | Title | Description | Priority | Complexity | Dependencies | Status |
|----|-------|-------------|----------|------------|--------------|--------|
| FB002 | DEBUG flag for development | Add environment flag (`VITE_DEBUG_MEDIA_SIZES`) to log available thumbnail/image sizes | P1 | S | None | completed |
| FB004 | Shareable media URLs | Opened media in preview should appear in URL (`#/gallery/:dialogId/view/:messageId`) for direct sharing | P1 | M | None | proposed |

### P2 - Medium Priority Features
| ID | Title | Description | Priority | Complexity | Dependencies | Status |
|----|-------|-------------|----------|------------|--------------|--------|
| FB003 | Author-based filtering | Filter gallery by message authors with checklist of all known participants | P2 | M | FB005 (author data) | proposed |
| FB005 | Improved media overlay | Show author name instead of meaningless Telegram auto-filenames; keep filenames for uploaded documents | P2 | S | None | proposed |

### P3 - Low Priority / Cosmetic
| ID | Title | Description | Priority | Complexity | Dependencies | Status |
|----|-------|-------------|----------|------------|--------------|--------|
| FB006 | Preview UI cosmetics | Remove opacity, make preview cover background completely (100%) | P3 | S | None | proposed |
| FB007 | Thumbnail refresh callback | Rerender thumbnails after media downloads complete | P3 | S | FB001 | proposed |
