# Work Mate backend deploy (no Docker), run ONLY after database migration and review.
# Commands are intentionally not automatically executed by this script.
# Requires npx Supabase CLI login and current project authorization.
# Navigate to C:\AFFAN_LAPTOP_BACKUP\workmate-web after overlaying this ZIP.
# npx.cmd supabase login
# npx.cmd supabase functions deploy manage-shift-plans --project-ref oshehhznsrbumiguvhbf
# npx.cmd supabase functions deploy submit-weekly-off-request --project-ref oshehhznsrbumiguvhbf
# npx.cmd supabase functions deploy review-weekly-off-request --project-ref oshehhznsrbumiguvhbf
# IMPORTANT: Keep user JWT verification ON. Do not use --no-verify-jwt.
# Verify the function versions in Supabase Dashboard. Then run the Vercel build.
# NEVER commit secrets, .env.local, or release-backups.
