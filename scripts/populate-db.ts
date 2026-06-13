import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || "Products";
const STOCK_TABLE = process.env.STOCK_TABLE_NAME || "Stock";

// Test data for products
const products = [
  {
    id: uuidv4(),
    title: "Nike Air Max 270",
    description: "Comfortable running shoes with excellent cushioning and modern design",
    price: 150,
  },
  {
    id: uuidv4(),
    title: "Adidas Ultraboost 22",
    description: "Premium running shoes with responsive cushioning",
    price: 180,
  },
  {
    id: uuidv4(),
    title: "Apple MacBook Pro 14-inch",
    description: "Powerful laptop with M3 chip, 16GB RAM, 512GB SSD",
    price: 1999,
  },
  {
    id: uuidv4(),
    title: "Sony WH-1000XM5",
    description: "Industry-leading noise canceling wireless headphones",
    price: 399,
  },
  {
    id: uuidv4(),
    title: "Samsung Galaxy S24",
    description: "Latest flagship smartphone with advanced camera system",
    price: 799,
  },
  {
    id: uuidv4(),
    title: "iPad Air 11-inch",
    description: "Versatile tablet with M2 chip and Apple Pencil support",
    price: 599,
  },
  {
    id: uuidv4(),
    title: "PlayStation 5",
    description: "Next-gen gaming console with 4K gaming capabilities",
    price: 499,
  },
  {
    id: uuidv4(),
    title: "Logitech MX Master 3S",
    description: "Ergonomic wireless mouse for professionals",
    price: 99,
  },
  {
    id: uuidv4(),
    title: "LG 27-inch 4K Monitor",
    description: "UHD monitor with HDR10 support and USB-C connectivity",
    price: 449,
  },
  {
    id: uuidv4(),
    title: "Kindle Paperwhite",
    description: "Waterproof e-reader with adjustable warm light",
    price: 139,
  },
];

// Function to populate products table
async function populateProducts() {
  console.log(`\n📦 Populating ${PRODUCTS_TABLE} table...`);
  
  for (const product of products) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: PRODUCTS_TABLE,
          Item: product,
        })
      );
      console.log(` Added product: ${product.title} (ID: ${product.id})`);
    } catch (error) {
      console.error(` Error adding product ${product.title}:`, error);
    }
  }
}

// Function to populate stock table
async function populateStock() {
  console.log(`Populating ${STOCK_TABLE} table...`);
  
  for (const product of products) {
    const stockCount = Math.floor(Math.random() * 100) + 10; // Random count between 10-110
    
    try {
      await docClient.send(
        new PutCommand({
          TableName: STOCK_TABLE,
          Item: {
            product_id: product.id,
            count: stockCount,
          },
        })
      );
      console.log(` Added stock for ${product.title}: ${stockCount} units`);
    } catch (error) {
      console.error(`Error adding stock for ${product.title}:`, error);
    }
  }
}

// Main function
async function main() {
  console.log("Starting database population...");
  console.log(`Region: ${process.env.AWS_REGION || "us-east-1"}`);
  console.log(`Products Table: ${PRODUCTS_TABLE}`);
  console.log(`Stock Table: ${STOCK_TABLE}`);
  
  try {
    await populateProducts();
    await populateStock();
    
    console.log("Database population completed successfully!");
    console.log(`   - Products added: ${products.length}`);
    console.log(`   - Stock records added: ${products.length}`);
  } catch (error) {
    console.error("Error during database population:", error);
    process.exit(1);
  }
}

// Run the script
main();
