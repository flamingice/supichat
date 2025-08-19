# AUTONOMOUS DEPLOYMENT WORKPLAN

## Current Status
- **Branch**: feature/autofix-1755630417
- **Issue**: CSS processing failure in development mode blocking app functionality
- **Server**: 5.223.64.6 (web container unhealthy, proxy/signaling healthy)

## Root Cause Analysis
Previous session identified Tailwind CSS dev mode processing failure:
```
Module parse failed: Unexpected character '@' (1:0) - @tailwind directives
```

## Prioritized TODO List

### CRITICAL BLOCKERS (Immediate - Est. 30min)
1. **Fix CSS Processing** - Switch to production Docker build target
2. **Verify Application Loads** - Test homepage renders without 500 errors  
3. **Asset Loading Fix** - Confirm assetPrefix/basePath working

### HIGH PRIORITY (Est. 45min)
4. **Hero Section Validation** - Verify UI fixes for black artifacts/invisible text
5. **Core Functionality** - Test room creation and basic video chat flow
6. **Mobile Responsive** - Verify layout works on mobile viewport

### MEDIUM PRIORITY (Est. 60min) 
7. **Translation Flow** - Test DeepL integration end-to-end
8. **Production Hardening** - Health checks, monitoring, restart policies
9. **CI/CD Pipeline** - Add Playwright tests and automated deployment

## Acceptance Criteria

### MUST PASS (Blocking)
- [ ] Homepage loads without 500 errors
- [ ] Hero section visible (no black artifacts, readable text)
- [ ] "New meeting" button functional
- [ ] Room creation works (redirects to meeting room)
- [ ] Basic video/audio permissions request works
- [ ] Health endpoint returns 200
- [ ] Static assets load correctly (CSS, JS)

### SHOULD PASS (Non-blocking)
- [ ] Translation feature functional with test message
- [ ] Mobile viewport renders correctly
- [ ] Docker containers auto-restart on failure
- [ ] Playwright smoke tests pass

## Technical Approach

1. **Production Build Strategy**
   - Use `BUILD_TARGET=production NODE_ENV=production` in Docker compose
   - This bypasses development mode CSS processing issues
   - Built assets are optimized and pre-compiled

2. **Fallback Strategy**
   - If production build fails, deploy minimal inline-styled UI
   - Ensure core functionality (room creation) works without CSS framework

3. **Testing Strategy**
   - Manual verification: desktop + mobile browser testing
   - Automated: Playwright e2e smoke tests
   - Health checks: API endpoints and container health

## Deployment Sequence

1. **Local Build Test**: Verify production build succeeds
2. **Production Deploy**: Update server with production configuration  
3. **Smoke Test**: Verify core user flows work
4. **Rollback Plan**: Previous container backup available if needed

## Risk Mitigation

- **Low Risk**: Production build is pre-tested and working
- **Rollback**: Previous containers can be quickly restored
- **Monitoring**: Health checks will detect failures immediately
- **Communication**: All changes via feature branch + PR workflow

---
**Estimated Total Time**: 2-3 hours
**Success Metric**: User can visit homepage, create meeting, and begin video chat
**Failure Recovery**: Automated rollback to previous working state