# SPEC-2A - Navigation & Route Map (PlantUML)

## Purpose

Visualize the app's route hierarchy (family-scoped with `:family_id`), modal flows, and key navigation sequences (login → family selection → dashboard, transactions modal flow, category modals, family switch). This diagram is desktop-first but notes mobile behavior where it differs.

---

## Top-level Route Hierarchy (PlantUML)

```plantuml
@startuml
' Top-level grouping
skinparam dpi 150
actor User
rectangle "Public Routes" {
  User --> (Landing)
  User --> (Login)
  User --> (Signup)
  User --> (Password Reset)
}
rectangle "App Shell (/app)" {
  User --> (AppRoot)
  (AppRoot) --> (Family Index)
  (AppRoot) --> (Family Scoped Routes)
}
rectangle "Family Scoped (/app/:family_id)" {
  (Family Scoped Routes) --> (Dashboard)
  (Family Scoped Routes) --> (Transactions)
  (Family Scoped Routes) --> (Accounts)
  (Family Scoped Routes) --> (Import)
  (Family Scoped Routes) --> (Family Page)
  (Family Scoped Routes) --> (Settings)
  (Family Scoped Routes) --> (Onboarding)
}
@enduml
```

---

## Modal and Nested Route Flow — Transactions example (PlantUML)

```plantuml
@startuml
skinparam dpi 150
actor User
participant "/app/:family_id/transactions" as TransactionsPage
participant "/app/:family_id/transactions/new" as NewTransactionModal
participant "/app/:family_id/transactions/:transactionId" as TransactionDetail

User -> TransactionsPage : Navigate to transactions list
TransactionsPage -> TransactionsPage : Render AgTransactionsGrid + FilterBar
User -> NewTransactionModal : Click "Add Transaction"
NewTransactionModal -> TransactionsPage : Open modal over TransactionsPage (nested route)
NewTransactionModal -> TransactionsPage : On save -> POST /transactions
note right of TransactionsPage: family id is derived from the access_token in the backend
NewTransactionModal -> TransactionsPage : Close modal -> history.back() or navigate to /app/:family_id/transactions

User -> TransactionDetail : Click transaction row -> navigate to /app/:family_id/transactions/:transactionId
TransactionDetail -> TransactionDetail : fetch GET /transactions/{id}?familyId={family_id}
TransactionDetail -> TransactionsPage : On update -> PUT /transactions/{id}
@enduml
```

---

## Family Page — Category Modal Flows (PlantUML)

```plantuml
@startuml
skinparam dpi 150
actor User
participant "/app/:family_id/family" as FamilyPage
participant "AddCategoryModal" as AddCat
participant "EditCategoryModal" as EditCat
participant "DeleteCategoryConfirm" as DeleteConfirm

User -> FamilyPage : Open Family page
FamilyPage -> FamilyPage : Render CategoryTree + CategoryGrid
User -> AddCat : Click "Add Category" (route: /app/:family_id/family/categories/new)
AddCat -> FamilyPage : POST /tenants/{family_id}/categories
AddCat -> FamilyPage : Close modal -> navigate back to /app/:family_id/family

User -> EditCat : Click edit on category (route: /app/:family_id/family/categories/:categoryId/edit)
EditCat -> FamilyPage : PUT /tenants/{family_id}/categories/{categoryId}

User -> DeleteConfirm : Click delete
DeleteConfirm -> FamilyPage : If reassign selected -> PUT /transactions/reassign-category
DeleteConfirm -> FamilyPage : DELETE /tenants/{family_id}/categories/{categoryId}
@enduml
```

---

## Family Switch & Unauthorized Flow (PlantUML)

```plantuml
@startuml
skinparam dpi 150
actor User
participant "Any /app/:family_id/* route" as FamilyRoute
participant "FamilySwitcher" as Switcher
participant "Backend" as API

User -> FamilyRoute : Enter URL with :family_id
FamilyRoute -> API : GET /tenants/{family_id} (with auth token)
API --> FamilyRoute : 200 OK (user member) OR 403/404
alt 200
  FamilyRoute -> API: POST /tenants/:family_id/switch
  API --> FamilyRoute: 200 OK with family scope access_token
  FamilyRoute -> FamilyRoute : render page
else 403/404
  FamilyRoute -> Switcher : Show error + open family switcher
  Switcher -> API : GET /tenants (list of families)
  API --> Switcher : list
  User -> Switcher : Select allowed family
  Switcher -> FamilyRoute : navigate to /app/{selected_family_id}/dashboard
end
@enduml
```

---

## Notes & Implementation Guidance

- Implement nested routes using React Router v6 `Outlet` components. Example route config (conceptual):

```
/app
  ├─ / (family index)
  └─ /:family_id
       ├─ /dashboard
       ├─ /transactions
       │    ├─ /new   (modal)
       │    └─ /:transactionId
       ├─ /accounts
       ├─ /family
       │    ├─ /categories/new
       │    └─ /categories/:categoryId/edit
       └─ /settings
```

- Modal routes should render as nested routes that preserve the parent page in the background. On mobile, consider rendering modal routes as full-screen pages.
- Keep the `family_id` param present in all navigation actions; use it as a required param in route definitions and link builders.
- Prefetch family metadata on route change to validate access and reduce flicker.

---

*Author:* Software Architect GPT

