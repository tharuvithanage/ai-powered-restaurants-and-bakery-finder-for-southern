# How to add a restaurant

There are **two** ways to add a restaurant in this project:

1) **Recommended (persists in MongoDB):** use the admin API `POST /api/admin/restaurants`
2) **Quick dev-only seed:** add a new entry to `sampleRestaurants` in `Backend/src/controllers/restaurantController.js`

---

## Option 1 (recommended): Admin API

### 1) Make your user an admin

If you already have a user account in MongoDB (created via register or Google login), promote it:

```bash
cd Backend
node src/scripts/promoteAdmin.js you@example.com
```

### 2) Login and get a token (PowerShell)

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email="you@example.com"; password="yourPassword" } | ConvertTo-Json)

$token = $login.token
```

### 3) Create the restaurant (PowerShell)

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/admin/restaurants" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body (@{
    id="my-new-restaurant"
    name="My New Restaurant"
    location="Galle"
    price="Moderate"
    desc="Nice food"
  } | ConvertTo-Json)
```

Required fields:
- `id` (slug like `my-new-restaurant`)
- `name`
- `location`
- `price` (e.g. `Budget`, `Moderate`, `Expensive`, `Luxury`)

Optional fields (supported by the API):
- `image`, `desc`, `hours`, `vibe`, `bestTime`, `address`, `mapQuery`
- `goodFor` (string array), `nearby` (string array), `dietaryTags` (string array)
- `coordinates` (`{ "lat": 6.0, "lng": 80.2 }`)

After creating, fetch it from the public API:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/restaurants/my-new-restaurant"
```

---

## Option 2 (quick dev-only): Add to seed list

1) Open `Backend/src/controllers/restaurantController.js`
2) Add a new object inside the `sampleRestaurants` array
3) Restart the backend server

Note: seed data is inserted with `bulkWrite(... upsert: true ...)`, so your new restaurant will be created in MongoDB the next time the server runs and the seed is applied.
