# Gold Ledger

**A retail business management application for tracking inventory, sales, expenses, revenue, and profit.**

Gold Ledger was created to help small retail businesses manage their daily financial and stock operations in one place. Originally designed around an ice cream business, the application can also be used to manage products such as perfumes, colognes, and other retail items.

**Live Application:** https://ghost-retailpro.lovable.app

## Overview

Managing a small retail business involves keeping track of stock purchases, product prices, sales, and expenses. Gold Ledger brings these operations together to make it easier to monitor business performance and understand profitability.

The application uses a dark black-and-gold interface designed to provide a clean and practical experience.

## Core Features

### Product and Inventory Management
- Manage products and their categories.
- Record purchase prices and selling prices.
- Track available stock quantities.
- Support different product types, with room to expand into categories such as shoes and electronics.

### Sales Management
- Record sales against available products.
- Track quantities sold and selling prices.
- Update stock quantities when sales are recorded.
- Calculate revenue and profit from sales.

### Expense Tracking
- Record business expenses.
- Track expense amounts and dates.
- Include expenses in overall business financial calculations.

### Financial Dashboard
- Monitor total revenue.
- Track business expenses.
- View calculated profit.
- Monitor stock levels and units sold.

## Design

Gold Ledger uses a dark-themed interface with a black-and-gold colour palette.

| Element | Colour |
|---|---|
| Background | `#000000` |
| Accent and buttons | `#FFD700` |
| Text | `#FFFFFF` |
| Hover states | `#E6C200` |
| Table backgrounds | `#121212` |

The interface is designed to be responsive across desktop and mobile screens.

## Future Improvements

Potential features for future development include:

- Sales reports with daily, weekly, and monthly trends.
- Exporting financial reports to CSV or PDF.
- Low-stock notifications.
- Dynamic product category creation.
- Multi-currency support.
- Additional user roles, such as Admin and Cashier.

## Built With

- [Lovable](https://lovable.dev/) — AI-assisted application development.
- GitHub — Source code management and version control.

The application is developed through Lovable, with changes synchronised to its connected GitHub repository.

## Run Locally

To work on the project locally, you need Node.js and npm installed.

**1. Clone the repository**

```bash
git clone https://github.com/Ghost-of-the-uchiha-0/ghost-retailpro.git
```

**2. Open the project directory**

```bash
cd ghost-retailpro
```

**3. Install dependencies**

```bash
npm install
```

**4. Start the development server**

```bash
npm run dev
```

## Repository Security

Before making the repository public, review the tracked files and Git history for accidentally committed environment files or private credentials.

If the repository includes the security-check script, run:

```bash
npm run security:repo
```

Review any reported findings before changing repository visibility. Never expose private service keys, passwords, or access tokens.

## Continue Development

This project can be continued in the [Lovable editor](https://lovable.dev/projects/7de53114-daac-45f0-b381-9b7f35a5326a).

---

**Project:** Gold Ledger  
**Developer:** Aubrey Nkuna  
**Development Approach:** AI-assisted development with Lovable  
**Live Demo:** https://ghost-retailpro.lovable.app