import { products } from "./mock/products";

 const handler = async (event : any) => {
  try {
    const productId = event.pathParameters.id;

    const product = products.find((p) => p.id === productId);

    if (!product) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(product),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error fetching product",
        error,
      }),
    };
  }
};
 export { handler };
