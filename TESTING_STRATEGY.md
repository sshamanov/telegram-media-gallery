# Telegram Gallery - UI Testing Strategy

## Overview
Comprehensive UI testing system with two test suites:
1. **Short Test**: Basic flows (auth, navigation, views) - runs frequently
2. **Long Test**: Full coverage (all features) - runs on major changes

## Test Architecture

### Test Framework
- **Playwright**: Cross-browser testing with mobile emulation
- **Mock Data**: Uses `VITE_USE_MOCK_ADAPTER=true` environment
- **Sample Data**: Pre-generated mock data in `samples/` directory

### Test Suites

#### 1. Short Test (`npm run test:short`)
**Purpose**: Quick validation of core functionality
**When to run**:
- After every logical block of work
- Before updating specs
- Before the end of a plan/phase
- On every commit

**Coverage**:
- Authentication flows (phone, QR)
- Dialog list navigation
- Gallery view transitions
- Basic UI interactions
- No uploads/downloads/sharing

**Timeout**: 60 seconds max

#### 2. Long Test (`npm run test:long`)
**Purpose**: Comprehensive validation of all features
**When to run**:
- On major changes (architecture, core logic)
- Before releases
- When changes affect features covered by long test but not short test
- Manual trigger when needed

**Coverage**:
- All short test features PLUS:
- Upload/download flows
- Sharing functionality
- Cache management
- Error states
- Mobile responsiveness
- Performance with large datasets

**Timeout**: 5 minutes max

## Test Flows

### Short Test Flow
```
1. App Launch
   - Load app with mock adapter
   - Verify auth screen appears

2. Authentication
   - Phone login flow
   - QR login flow
   - Verify successful login

3. Dialog Navigation
   - Load dialog list
   - Switch tabs (Galleries/Groups/Chats)
   - Search functionality
   - Select a dialog

4. Gallery View
   - Load media grid
   - Switch to list view
   - Filter media types
   - Basic selection

5. Fullscreen Viewer
   - Open media in viewer
   - Navigate between items
   - Close viewer

6. Settings
   - Open settings panel
   - Verify settings load
   - Close settings
```

### Long Test Flow (Additional)
```
7. Upload Flow
   - Upload media/file
   - Verify progress
   - Verify completion

8. Download Flow
   - Select and download items
   - Verify download progress
   - Verify completion

9. Sharing & Forwarding
   - Share functionality
   - Forward to dialogs
   - Copy to clipboard

10. Cache Management
    - Clear thumbnails cache
    - Clear full media cache
    - Verify storage updates

11. Error States
    - Network errors
    - Offline mode
    - Rate limiting

12. Mobile Testing
    - Touch interactions
    - Pull-to-refresh
    - Mobile gestures

13. Performance
    - Large dataset loading
    - Memory usage
    - Scroll performance
```

## Mock Data Requirements

### Sample Files Structure
```
samples/
├── dialogs.json              # Dialog list data
├── dialog-media/            # Media for each dialog
│   ├── gallery_photos.json
│   ├── work_chat.json
│   └── family_chat.json
└── media-files/             # Binary files (thumbnails)
    └── thumbnails/
        ├── photo1_thumb.jpg
        ├── photo2_thumb.jpg
        └── video1_thumb.jpg
```

### Mock Adapter Behavior
- Returns pre-defined dialog list
- Provides sample media items
- Simulates network delays (100-500ms)
- Simulates download progress
- Handles authentication with mock data

## Agent/Kilo Rules

### Testing Rules for Agents
1. **Short Test Mandatory**:
   - Run `npm run test:short` after every logical block of work
   - Fix any failures before proceeding
   - Run before updating APPLICATION_SPEC.md
   - Run before completing a plan/phase

2. **Long Test Triggers**:
   - Run `npm run test:long` when:
     - Changing authentication logic
     - Modifying navigation flows
     - Updating core UI components
     - Changing data fetching logic
     - Before major releases
   - Can be run manually when needed

3. **Test Environment**:
   - Always use mock adapter (`VITE_USE_MOCK_ADAPTER=true`)
   - Run in headless mode for CI
   - Use mobile viewport for responsive testing

4. **Failure Handling**:
   - Test failures must be addressed immediately
   - Update tests if behavior changes intentionally
   - Document test changes in commit messages

### Kilo Command Integration
```bash
# Development workflow
kilo test:short    # Run short test suite
kilo test:long     # Run long test suite
kilo test:all      # Run both suites

# CI/CD integration
kilo ci:test       # Run appropriate tests based on changes
```

## Implementation Plan

### Phase 1: Foundation
1. Install Playwright and dependencies
2. Create sample mock data files
3. Set up test configuration

### Phase 2: Short Test
1. Implement authentication tests
2. Implement navigation tests
3. Implement basic UI tests
4. Verify short test passes

### Phase 3: Long Test
1. Extend with upload/download tests
2. Add sharing/forwarding tests
3. Implement cache management tests
4. Add error state tests

### Phase 4: Integration
1. Update AGENTS.md with testing rules
2. Create Kilo commands
3. Set up CI/CD pipeline
4. Document test usage

## Success Criteria

### Short Test Success
- All authentication flows work
- Navigation between screens works
- Basic UI interactions function
- Test completes within 60 seconds
- No critical errors in console

### Long Test Success
- All short test criteria met
- Upload/download functionality works
- Sharing/forwarding works
- Cache management functions
- Error states handled properly
- Mobile responsiveness verified
- Test completes within 5 minutes

## Maintenance

### Test Updates
- Update tests when UI changes
- Keep mock data current
- Review test coverage quarterly
- Update testing rules as needed

### Performance Monitoring
- Track test execution time
- Monitor test stability
- Address flaky tests promptly
- Optimize slow tests

## References
- [Playwright Documentation](https://playwright.dev/)
- [Mock Data Specification](samples/INDEX.md)
- [Application Specification](APPLICATION_SPEC.md)
- [Agent Instructions](AGENTS.md)