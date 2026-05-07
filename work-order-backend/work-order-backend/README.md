# Work Order Backend — Setup Guide

Express + PostgreSQL API that powers the Angular autocomplete feature.

---

## 📁 Files

```
work-order-backend/
├── server.js      ← Express routes (search, get item)
├── db.js          ← PostgreSQL connection pool
├── .env           ← Your DB credentials (edit this!)
└── package.json
```

---

## 🗄️ Step 1 — Set up your database table

The backend expects a table in your PostgreSQL database. If you already have
a table with item descriptions, rates, and units — just update the CONFIG
block in `server.js` to match your column names.

If you want to create a fresh table, run this in psql or pgAdmin:

```sql
CREATE TABLE work_items (
  id          SERIAL PRIMARY KEY,
  description TEXT           NOT NULL,
  unit        VARCHAR(50),
  rate        NUMERIC(12, 2) DEFAULT 0,
  is_material BOOLEAN        DEFAULT false
);

-- Sample data to test with:
INSERT INTO work_items (description, unit, rate, is_material) VALUES
  ('Brick Masonry in CM 1:6',        'cum',  4500.00, true),
  ('Brick Masonry in CM 1:4',        'cum',  5200.00, true),
  ('Cement Plastering 12mm thick',   'sqm',   320.00, false),
  ('Cement Plastering 20mm thick',   'sqm',   380.00, false),
  ('PCC M15 Grade',                  'cum',  4200.00, false),
  ('RCC M20 Grade',                  'cum',  7800.00, false),
  ('Reinforcement Steel Fe500',      'kg',     75.00, true),
  ('Sand Filling',                   'cum',   900.00, true),
  ('Earthwork Excavation',           'cum',   350.00, false),
  ('Floor Tiles 600x600',            'sqm',   850.00, true);
```

---

## ⚙️ Step 2 — Configure your credentials

Edit the `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_actual_database_name
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
PORT=3000
```

---

## 🔧 Step 3 — Map YOUR table columns (if different)

Open `server.js` and find the CONFIG block near the top:

```js
const CONFIG = {
  table:          'work_items',   // ← your table name
  col_id:         'id',           // ← your primary key column
  col_description:'description',  // ← your description column
  col_unit:       'unit',         // ← your unit column
  col_rate:       'rate',         // ← your rate/price column
  col_isMaterial: 'is_material',  // ← your boolean material column
};
```

Change only the **values** (right side) to match your actual column names.

---

## 🚀 Step 4 — Install & run

```bash
cd work-order-backend
npm install
npm start
```

You should see:
```
✅ Connected to PostgreSQL successfully
🚀 Server running at http://localhost:3000
```

Test it in your browser or Postman:
```
http://localhost:3000/api/items/search?q=brick
http://localhost:3000/api/health
```

---

## 🔗 Step 5 — Run the Angular frontend

In a separate terminal:
```bash
cd work-order-app
npm install
ng serve
```

Open: http://localhost:4200

Now when you type in the **Description** box, it will:
1. Search your PostgreSQL database after 2+ characters
2. Show a dropdown of matching items
3. On selection → auto-fill **Rate**, **Unit**, **Is Material**, and **Amount**

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on DB connect | Check `.env` credentials, ensure PostgreSQL is running |
| Empty search results | Verify table name and column names in CONFIG |
| CORS error in browser | Backend already has CORS enabled — check the port matches in `work-item.service.ts` |
| Angular can't reach backend | Make sure backend is running on port 3000; change `baseUrl` in `work-item.service.ts` if different |
