// @ts-nocheck
import { Schema, model, Document } from 'mongoose';

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface StoreProduct extends Document {
  id: string;
  storeId: string;
  storeName: string;
  storeType: 'homeDepot' | 'lowes' | 'ace' | 'menards' | 'local';
  address: Address;
  lat: number;
  lng: number;
  productName: string;
  category: string;
  subcategory: string;
  sku: string;
  upc: string;
  price: number;
  unit: 'each' | 'sqft' | 'linearft' | 'lb' | 'gallon' | 'box';
  quantityAvailable: number;
  inStock: boolean;
  imageUrl: string;
  productUrl: string;
  lastUpdated: Date;
}

const StoreProductSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  storeId: { type: String, required: true },
  storeName: { type: String, required: true },
  storeType: { type: String, required: true, enum: ['homeDepot', 'lowes', 'ace', 'menards', 'local'] },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  productName: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  sku: { type: String, required: true },
  upc: { type: String, required: true },
  price: { type: Number, required: true },
  unit: { type: String, required: true, enum: ['each', 'sqft', 'linearft', 'lb', 'gallon', 'box'] },
  quantityAvailable: { type: Number, required: true },
  inStock: { type: Boolean, required: true },
  imageUrl: { type: String },
  productUrl: { type: String },
  lastUpdated: { type: Date, default: Date.now }
});

// Create model
const StoreProduct = model<StoreProduct>('StoreProduct', StoreProductSchema);

export default StoreProduct;

export type StoreProductType = typeof StoreProduct;