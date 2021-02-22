import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
  price: number;
}

interface IRequest {
  id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(id);
    if (!customer) {
      throw new AppError('Custumer not found');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );
    if (!existentProducts.length) {
      throw new AppError('Products not found');
    }

    const existentProductIds = existentProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existentProductIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not findo product ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductsWithNoQuantityAvaliable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvaliable.length) {
      throw new AppError(
        `the quantity ${findProductsWithNoQuantityAvaliable[0].quantity} is not avaliable for product ${findProductsWithNoQuantityAvaliable[0].product_id} `,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existentProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
