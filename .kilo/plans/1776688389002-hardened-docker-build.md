# Hardened Docker Build Plan

**Plan ID:** 1776688389002-hardened-docker-build  
**Created:** 2026-04-20 17:39 +02:00  
**Status:** completed  
**Goal:** Create hardened Dockerfile.prod for running in restricted environments with non-root user support.

## Overview
Create a production-hardened Docker image that can run in restricted environments with the following security features:
1. Non-root user execution (UID/GID 1001)
2. Minimal runtime dependencies
3. Read-only filesystem where possible
4. No build tools or source code in final image
5. Health check and proper signal handling
6. Configurable UID/GID via environment variables

## Execution Strategy
5 blocks:

### Block 1: Update STATUS.md and create plan
- Update STATUS.md to register new plan
- Create this plan file
- Update Next Execution Order

### Block 2: Create Dockerfile.prod with non-root user
- Create `Dockerfile.prod` with multi-stage build
- First stage: builder with all build tools
- Second stage: minimal runtime with non-root user
- Set proper permissions and ownership
- Add health check and entrypoint script
- Configure for read-only operation where possible

### Block 3: Update GitHub Actions workflow
- Update `.github/workflows/docker-build-push.yml`
- Build from `Dockerfile.prod` instead of `Dockerfile`
- Keep existing tagging and push logic
- Update validation steps if needed

### Block 4: Test Dockerfile.prod build
- Test build locally with `docker build -f Dockerfile.prod`
- Test running as non-root user
- Test configurable UID/GID via environment
- Verify health check works

### Block 5: Run validation checks
- Run type check (`npm run check`)
- Ensure Docker build succeeds
- Update STATUS.md with completion

## Success Criteria
- `Dockerfile.prod` exists with hardened configuration
- Image runs as non-root user (UID 1001)
- No build tools or source code in final image
- GitHub Actions workflow builds from `Dockerfile.prod`
- Type check passes (0 errors, 0 warnings)
- STATUS.md updated with plan completion

## Validation Requirements
- Type check must pass: `npm run check` (0 errors, 0 warnings)
- Docker build from `Dockerfile.prod` must succeed
- Image must run with `docker run --user 1001` successfully
- Health check must respond correctly

## Files to Touch
- `Dockerfile.prod` (new)
- `.github/workflows/docker-build-push.yml` (update)
- `STATUS.md` (update plan status)
- `.kilo/plans/1776688389002-hardened-docker-build.md` (this file)

## Dependencies
- Existing GitHub Actions workflow
- Existing Docker build process

## Notes
- Keep original `Dockerfile` for development/testing
- `Dockerfile.prod` is for production/hardened environments
- Non-root user improves security in containerized environments
- Configurable UID/GID allows integration with Kubernetes/OpenShift
- Read-only filesystem reduces attack surface