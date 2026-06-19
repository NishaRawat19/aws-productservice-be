/// <reference types="jest" />

import { handler } from "../lambda/catalogBatchProcess";

var sendMock: jest.Mock;

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const originalModule = jest.requireActual("@aws-sdk/lib-dynamodb");

  sendMock = jest.fn();

  return {
    ...originalModule,
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send: sendMock })),
    },
    PutCommand: jest.fn().mockImplementation((input: any) => ({ input })),
  };
});

jest.mock("@aws-sdk/client-sns", () => {
	return {
		SNSClient: jest.fn(() => ({})),
		PublishCommand: jest.fn((input: any) => ({ input })),
	};
});

describe("catalogBatchProcess Lambda", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.PRODUCTS_TABLE_NAME = "Products";
    process.env.STOCK_TABLE_NAME = "Stock";
  });

  afterEach(() => {
    delete process.env.PRODUCTS_TABLE_NAME;
    delete process.env.STOCK_TABLE_NAME;
  });

  it("creates products for all SQS messages", async () => {
    const event = {
      Records: [
        {
          messageId: "1",
          body: JSON.stringify({
            title: "Product 1",
            description: "Desc 1",
            price: 10,
            count: 5,
          }),
        },
        {
          messageId: "2",
          body: JSON.stringify({
            title: "Product 2",
            description: "Desc 2",
            price: 20,
            count: 0,
          }),
        },
      ],
    } as any;

    await handler(event);

    // Two PutCommands per message: one for Products and one for Stock
    expect(sendMock).toHaveBeenCalledTimes(4);

    const calls = sendMock.mock.calls;
    const productTableCalls = calls.filter(
      ([command]: any) => command.input.TableName === "Products"
    );
    const stockTableCalls = calls.filter(
      ([command]: any) => command.input.TableName === "Stock"
    );

    expect(productTableCalls.length).toBe(2);
    expect(stockTableCalls.length).toBe(2);
  });
});
