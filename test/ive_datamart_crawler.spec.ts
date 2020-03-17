// handler.spec.ts
//import * as mocha from 'mocha';
import * as chai from 'chai';
//import { APIGatewayEvent, Handler, Callback, Context } from 'aws-lambda';
import { ive_datamart_crawler } from '../src/ive_datamart_crawler';

const expect = chai.expect;

describe("handler ive_datamart_crawler", () => {
  describe("ive_datamart_crawler test", () => {
    it("should return Serverless boilerplate message", () => {
      ive_datamart_crawler(null, null, (error: Error, result: any) => {
        console.log(result.body, 'body')
        expect(error).to.be.null;
        expect(result.body).to.equal('"Datamart file processed successfully!"');
      })
    });
  });
});