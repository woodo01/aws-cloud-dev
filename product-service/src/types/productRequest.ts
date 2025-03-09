import { Product } from "./product";

export interface ProductRequest extends Product {
  count: number;
}