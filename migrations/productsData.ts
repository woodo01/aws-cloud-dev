import { Product } from '../src/types/product';

export const productsData: Omit<Product, 'id'>[] = [
    {
      title: 'Product 1',
      description: "Description 1",
      price: 30
    },
    {
      title: 'Product 2',
      description: 'Description 2',
      price: 10
    },
    {
      title: 'Product 3',
      description: 'Description 3',
      price: 20
    },
    {
      title: 'Product 4',
      description: 'Description 4',
      price: 40
    },
    {
      title: 'Product 5',
      description: 'Description 5',
      price: 50
    }
  ];