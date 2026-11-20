# Gold Ledger

AI Developer Prompt: Build a Dark-Themed Financial Web App for a Retail Business

Project Overview:
Create a full-stack web application for managing sales, stock, and expenses for a small retail business. Initially handle ice creams and perfumes/colognes, with placeholders for future products (shoes, headsets, etc.). Use a dark theme (black & gold) for UI/UX.

Functional Requirements

Authentication

 Admin login only (email + password).

 Optional: future multi-user support (roles: Admin, Cashier).

Product Management

 Add/edit/delete products.

 Fields: Product Name, Category, Purchase Price, Selling Price, Quantity in Stock, Date Added.

 Include empty slots for future categories like shoes, electronics, etc.

Stock & Expense Tracking

 Add stock purchases: product, quantity, purchase price, date.

 Add expenses: expense name, amount, date.

 Validation: quantity and prices must be ≥ 0.

Sales Management

 Add sales: product, quantity sold, auto-filled selling price, date.

 Automatically update stock (subtract sold units).

 Calculate profit per sale: (Selling Price − Purchase Price) * Quantity Sold.

 Update total revenue, expenses, net profit dynamically.

Dashboard

 Display:

 Current stock per product

 Total revenue, total expenses, net profit

 Total units sold per product

 Graphs/charts for sales trends (daily, weekly, monthly)

 Use Chart.js or Recharts with black background, gold accents.

Technical Requirements

Front-End

Framework: React.js or Vue.js

UI/UX Theme: Dark Mode

 Background: Black (#000000)

 Accent & Buttons: Gold (#FFD700)

 Text: White (#FFFFFF) for readability

 Hover/active states: slightly darker gold (#E6C200)

Components:

 Product management table (sortable, searchable)

 Sales form (dropdown for products, quantity input)

 Expense form

 Dashboard with charts

 Login form

Validation: Client-side validation for stock, prices, sales, expenses.

Back-End

Framework: Node.js + Express.js

API Endpoints:

/api/products → GET, POST, PUT, DELETE

/api/sales → GET, POST

/api/expenses → GET, POST

/api/reports → GET

Business Logic:

 On sale, subtract stock automatically

 Calculate profit per sale

 Track cumulative totals for revenue, expenses, profit

 Prevent negative stock values

Database

Type: Relational (PostgreSQL/MySQL) or NoSQL (MongoDB)

Schema Example:

Table: products
- id (PK)
- name
- category
- purchase_price
- selling_price
- stock_quantity
- created_at
- updated_at

Table: sales
- id (PK)
- product_id (FK)
- quantity_sold
- selling_price
- total_profit
- sale_date

Table: expenses
- id (PK)
- name
- amount
- expense_date

UX & UI Details

 Dark UI theme: black background, gold buttons, white text.

 Responsive design for desktop and mobile.

 Hover effects: gold hover on buttons and links.

 Data tables: striped rows with dark grey (#121212) alternating.

 Chart colors: gold for lines/bars, subtle white gridlines.

Optional Features / Future Scalability

 Export reports to CSV or PDF

 Low stock alerts (notification system)

 Multi-currency support

 Multi-user role support

 Future product categories (shoes, electronics, etc.) with dynamic category creation.

Edge Cases / Validations

 Stock cannot be negative.

 Selling price cannot be lower than 0.

 Purchase price cannot be negative.

 Handle rounding for currency.

 Editing historical data updates all dependent calculations.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ghost-retailpro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7de53114-daac-45f0-b381-9b7f35a5326a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
