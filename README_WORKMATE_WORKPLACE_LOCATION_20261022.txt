WORK MATE — LOCAL ADD EMPLOYEE WORKPLACE / LOCATION PATCH

Changed code files:
  app/employees/new/page.tsx
  app/employees/new/staff-form.tsx
  app/api/employees/create/route.ts

Features:
- Required Workplace dropdown: Office, Store, Warehouse.
- Required Work Location dropdown: existing active office_locations records.
- Date of Joining required because the existing create-employee Edge Function
  requires it whenever workplace/location is supplied.
- Form payload and local API validations cover all three values.
- Existing active employee locations loaded read-only; no schema change.
- Existing stagingWriteError() safety lock retained. No production writes.

Apply locally in PowerShell:
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Employee_Workplace_Location_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npm.cmd run dev

Open: http://localhost:3000/employees/new

Note: The local Create Employee action remains locked if connected to
production Supabase. To test real creation, configure a separate staging
Supabase project with the Work Mate schema and create-employee function.
No Vercel deployment or live Supabase change performed.
