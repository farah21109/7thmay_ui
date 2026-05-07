# Work Order App (Angular 17)

A pixel-accurate Angular replica of the Work Order / BOQ (Bill of Quantities) form.

---

## 📁 Project Structure

```
work-order-app/
├── src/
│   ├── app/
│   │   ├── work-order/
│   │   │   ├── work-order.component.ts      ← Component logic
│   │   │   ├── work-order.component.html    ← Template
│   │   │   ├── work-order.component.css     ← Styles
│   │   │   └── work-order.model.ts          ← Interfaces
│   │   └── app.component.ts                 ← Root component
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
├── tsconfig.json
└── tsconfig.app.json
```

---

## 🚀 Setup & Run

### Prerequisites
- **Node.js** v18+ → https://nodejs.org
- **Angular CLI** v17 → install with:
  ```bash
  npm install -g @angular/cli
  ```

### Steps

1. **Copy this folder** to your machine (e.g. `work-order-app/`)

2. **Install dependencies**:
   ```bash
   cd work-order-app
   npm install
   ```

3. **Start the dev server**:
   ```bash
   ng serve
   ```

4. **Open in browser**:
   ```
   http://localhost:4200
   ```

---

## ✅ Features

| Feature | Details |
|---|---|
| **Name Of Work** | Top input field (required) |
| **Add rows** | Click "Add" to save a row and open a new one |
| **Edit rows** | Click "Edit" on a saved row to bring it back for editing |
| **Delete rows** | Click "Delete" to remove a saved row |
| **Auto Amount** | Amount = Numbers(X×Y) × Length × Breadth × Depth × Rate |
| **Row Total** | Sum of all saved row amounts |
| **GST %** | Enter GST rate → auto-computes GST amount |
| **Service Tax %** | Enter Service Tax rate → auto-computes |
| **Grand Total** | Total Amount + GST + Service Tax |
| **Is Description** | Yes = dimensions mode, No = qty×rate mode |

---

## 🎨 Color Scheme (matches original)

- **Header row**: Light blue (`#add8e6`)
- **Table background**: Cream/ivory (`#fefef5`, `#fffff0`)
- **Totals header**: Dark olive gold (`#8b8040`)
- **Add button**: Green (`#5cb85c`)
- **Cancel/Delete**: Red (`#d9534f`)
- **Edit**: Orange (`#f0ad4e`)

---

## 🔧 Customization

### Change GST/Service Tax defaults
In `work-order.component.ts`, update:
```ts
gstRate: number = 18;       // default 18%
serviceTaxRate: number = 5; // default 5%
```

### Add more units to a dropdown
Replace the Unit text input in the HTML with a `<select>`:
```html
<select [(ngModel)]="currentItem.unit" class="input-unit">
  <option value="">--</option>
  <option value="m">m</option>
  <option value="sqm">sqm</option>
  <option value="cum">cum</option>
  <option value="nos">nos</option>
  <option value="kg">kg</option>
</select>
```

---

## 📦 Build for Production

```bash
ng build --configuration production
```
Output goes to `dist/work-order-app/`.
