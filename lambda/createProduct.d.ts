/**
 * POST /products
 * Creates a new product in the Products table
 */
declare const handler: (event: any) => Promise<{
    statusCode: number;
    headers: {
        "Content-Type": string;
        "Access-Control-Allow-Origin": string;
    };
    body: string;
}>;
export { handler };
