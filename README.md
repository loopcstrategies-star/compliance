# MYKA compliance

Customer onboarding for MYKA Precious Metals Trading LLC. One web application and one API share a tenant-isolated PostgreSQL database. Customers complete the source KYC pack. A maker, a checker, and an authorised approver review the case. Employees see operational counts. A super-admin configures the tenant and cannot open customer identity files without a separate permission.

The four source PDFs stay in `docs/templates/source`. Unresolved answer rectangles are not painted. No cloud region is selected.

## Local use

Start the database, apply migrations, and run the two dev servers as described in [docs/phase8/operations.md](docs/phase8/operations.md).

```
npm test
```

Run the API tests from the repository root. They use the local database.

Secrets belong in `.env`, which is gitignored. Do not commit passwords, authenticator secrets, or the backup key.
