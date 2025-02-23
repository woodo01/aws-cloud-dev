#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductServiceStack } from "../src/stack";

const app = new cdk.App();
new ProductServiceStack(app, 'ProductServiceStack', {
  env: { 
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
