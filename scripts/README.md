# Database Scripts

This directory contains scripts for managing DynamoDB tables.

## Scripts

### populate-db.ts

Populates the Products and Stock DynamoDB tables with test data.

#### Usage

```bash
npm run populate-db
```

#### What it does

1. Creates 10 sample products with:
   - Unique UUID for each product
   - Title, description, and price
   
2. Creates corresponding stock records with:
   - product_id (foreign key to products.id)
   - Random count between 10-110 units

#### Environment Variables

- `AWS_REGION` - AWS region (default: us-east-1)
- `PRODUCTS_TABLE_NAME` - Products table name (default: Products)
- `STOCK_TABLE_NAME` - Stock table name (default: Stock)

#### Prerequisites

- AWS credentials configured
- DynamoDB tables created (run `npx cdk deploy` first)
- Required npm packages installed

## Sample Data

The script includes 10 products across different categories:
- Electronics (laptops, phones, tablets, gaming consoles)
- Accessories (headphones, mouse, monitor, e-reader)
- Footwear (running shoes)

Each product has realistic descriptions and prices.
