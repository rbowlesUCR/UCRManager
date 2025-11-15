═══════════════════════════════════════════════════════════════════════════
  PRODUCTION DEPLOYMENT - NOVEMBER 15, 2025
  Instructions for Production Claude
═══════════════════════════════════════════════════════════════════════════

Hi Production Claude!

You're being asked to deploy the November 15, 2025 release to the production
server at 20.168.122.70. Everything is ready - code is tested, committed, and
pushed to GitHub main branch.

═══════════════════════════════════════════════════════════════════════════
  WHAT YOU NEED TO KNOW
═══════════════════════════════════════════════════════════════════════════

✅ All code tested and working on dev server
✅ All commits pushed to GitHub (main branch)
✅ No database migrations required
✅ Low risk deployment (additive features only)
✅ Easy rollback available

═══════════════════════════════════════════════════════════════════════════
  DOCUMENTS TO READ
═══════════════════════════════════════════════════════════════════════════

1. PROD_DEPLOYMENT_QUICKSTART.md
   → Quick copy/paste commands for deployment

2. HANDOFF_TO_PROD_CLAUDE_NOV15.md
   → Complete context, troubleshooting, verification steps

3. DEPLOYMENT_2025_11_15.md
   → Feature details, rollback plan

4. SESSION_STATUS.md
   → Full development history and testing status

═══════════════════════════════════════════════════════════════════════════
  QUICK START (If you just want to deploy now)
═══════════════════════════════════════════════════════════════════════════

On production server 20.168.122.70:

cd C:\inetpub\wwwroot\UCRManager
git branch backup-before-nov-15-deploy
pm2 stop ucrmanager
git checkout main
git pull origin main
npm run build
pm2 start ucrmanager
pm2 logs ucrmanager --lines 50

That's it! Then verify by testing the work role dropdown.

═══════════════════════════════════════════════════════════════════════════
  WHAT THIS DEPLOYMENT ADDS
═══════════════════════════════════════════════════════════════════════════

1. ConnectWise Work Role Selection
   - Operators can select appropriate billing rates
   - Filtered to only show UCRight/Salient roles
   - Falls back to default if not selected

2. Phone Number Column Customization
   - Show/hide any column
   - Reorder columns with arrows
   - Access Notes column for assignment history

3. Phone Number History Tracking
   - Auto-logs assignments/releases with timestamps
   - Visible in Notes column

4. Bug Fixes
   - Old number release bug fixed
   - ConnectWise emoji JSON error fixed
   - Status filtering enhanced

═══════════════════════════════════════════════════════════════════════════
  VERIFICATION
═══════════════════════════════════════════════════════════════════════════

After deployment:
1. Login to https://20.168.122.70
2. Dashboard → Select tenant → User → Ticket number
3. Check: "Select Work Role" dropdown appears
4. Number Management → "Customize Columns" button works

═══════════════════════════════════════════════════════════════════════════
  SUPPORT
═══════════════════════════════════════════════════════════════════════════

If you need help:
- Check HANDOFF_TO_PROD_CLAUDE_NOV15.md for troubleshooting
- Rollback instructions in all deployment docs
- PM2 logs: pm2 logs ucrmanager

═══════════════════════════════════════════════════════════════════════════

Questions? Read HANDOFF_TO_PROD_CLAUDE_NOV15.md - it has everything you need!

Good luck! 🚀

- Dev Claude
