// @ts-nocheck
import { StoreProduct } from '../models/StoreProduct';
import { StoreSearchParams } from './types';

/**
 * Mock Store Data Provider
 * Generates realistic mock data for all common construction materials
 * with multiple store profiles and realistic pricing variations
 */

export class StoreDataProvider {
  private mockProducts: StoreProduct[] = [];
  private storeProfiles: { [storeId: string]: StoreProduct[] } = {};

  constructor() {
    this.loadMockData();
    this.setupStoreProfiles();
  }

  private loadMockData(): void {
    // Comprehensive list of common construction materials with realistic pricing
    const baseProducts: Omit<StoreProduct, 'id' | 'lastUpdated'>[] = [
      // Lumber
      {
        storeId: 'hd-1001',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: '2x4 Lumber - 8ft',
        category: 'lumber',
        subcategory: 'dimensional',
        sku: '345678',
        upc: '041100012345',
        price: 3.5,
        unit: 'each',
        quantityAvailable: 120,
        inStock: true,
        imageUrl: 'https://example.com/images/2x4-8ft.jpg',
        productUrl: 'https://www.homedepot.com/p/2x4-8ft',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2001',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: '2x4 Lumber - 8ft',
        category: 'lumber',
        subcategory: 'dimensional',
        sku: '876543',
        upc: '041100067890',
        price: 3.25,
        unit: 'each',
        quantityAvailable: 95,
        inStock: true,
        imageUrl: 'https://example.com/images/2x4-8ft.jpg',
        productUrl: 'https://www.lowes.com/p/2x4-8ft',
        lat: 21.4152,
        lng: -157.9995
      },
      {
        storeId: 'ace-3001',
        storeName: 'Ace Hardware - Ala Moana',
        storeType: 'ace',
        address: { street: '789 Kani St', city: 'Honolulu', state: 'HI', zip: '96815', country: 'USA' },
        productName: '2x4 Lumber - 8ft',
        category: 'lumber',
        subcategory: 'dimensional',
        sku: '112233',
        upc: '041100011223',
        price: 3.75,
        unit: 'each',
        quantityAvailable: 75,
        inStock: true,
        imageUrl: 'https://example.com/images/2x4-8ft.jpg',
        productUrl: 'https://www.acehardware.com/p/2x4-8ft',
        lat: 21.3001,
        lng: -157.8600
      },
      // Fasteners
      {
        storeId: 'hd-1002',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: '3\\\" Common Nails - 1lb Box',
        category: 'fasteners',
        subcategory: 'nails',
        sku: '456789',
        upc: '041100045678',
        price: 5.99,
        unit: 'box',
        quantityAvailable: 45,
        inStock: true,
        imageUrl: 'https://example.com/images/nails-3in.png',
        productUrl: 'https://www.homedepot.com/p/3-16-common-nails-1lb-box',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2002',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: '3\\\" Common Nails - 1lb Box',
        category: 'fasteners',
        subcategory: 'nails',
        sku: '987654',
        upc: '041100098765',
        price: 5.49,
        unit: 'box',
        quantityAvailable: 60,
        inStock: true,
        imageUrl: 'https://example.com/images/nails-3in.png',
        productUrl: 'https://www.lowes.com/p/3-16-common-nails-1lb-box',
        lat: 21.4152,
        lng: -157.9995
      },
      // Connectors
      {
        storeId: 'hd-1003',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: 'Simpson Strong-Tie 1\\\" Joist Hanger - 10pcs',
        category: 'connectors',
        subcategory: 'hangers',
        sku: '246810',
        upc: '041100024681',
        price: 12.99,
        unit: 'box',
        quantityAvailable: 30,
        inStock: true,
        imageUrl: 'https://example.com/images/joist-hanger-10pcs.jpg',
        productUrl: 'https://www.homedepot.com/p/Simpson-Strong-Tie-Joist-Hanger-10pcs',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2003',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: 'Simpson Strong-Tie 1\\\" Joist Hanger - 10pcs',
        category: 'connectors',
        subcategory: 'hangers',
        sku: '135792',
        upc: '041100013579',
        price: 11.99,
        unit: 'box',
        quantityAvailable: 35,
        inStock: true,
        imageUrl: 'https://example.com/images/joist-hanger-10pcs.jpg',
        productUrl: 'https://www.lowes.com/p/Simpson-Strong-Tie-Joist-Hanger-10pcs',
        lat: 21.4152,
        lng: -157.9995
      },
      // Electrical
      {
        storeId: 'hd-1004',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: '14/2 Romex - 250ft',
        category: 'electrical',
        subcategory: 'wiring',
        sku: '112244',
        upc: '041100011224',
        price: 45.99,
        unit: 'ft',
        quantityAvailable: 20,
        inStock: true,
        imageUrl: 'https://example.com/images/romex-14-2.jpg',
        productUrl: 'https://www.homedepot.com/p/14-2-Romex-250ft',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2004',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: '14/2 Romex - 250ft',
        category: 'electrical',
        subcategory: 'wiring',
        sku: '556677',
        upc: '041100055667',
        price: 44.99,
        unit: 'ft',
        quantityAvailable: 25,
        inStock: true,
        imageUrl: 'https://example.com/images/romex-14-2.jpg',
        productUrl: 'https://www.lowes.com/p/14-2-Romex-250ft',
        lat: 21.4152,
        lng: -157.9995
      },
      // Plumbing
      {
        storeId: 'hd-1005',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: '1/2\\\" PEX Tubing - 100ft',
        category: 'plumbing',
        subcategory: 'tubing',
        sku: '334455',
        upc: '041100033445',
        price: 35.99,
        unit: 'ft',
        quantityAvailable: 15,
        inStock: true,
        imageUrl: 'https://example.com/images/pex-1-2.jpg',
        productUrl: 'https://www.homedepot.com/p/1-2-PEX-Tubing-100ft',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2005',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: '1/2\\\" PEX Tubing - 100ft',
        category: 'plumbing',
        subcategory: 'tubing',
        sku: '667788',
        upc: '041100066778',
        price: 34.99,
        unit: 'ft',
        quantityAvailable: 18,
        inStock: true,
        imageUrl: 'https://example.com/images/pex-1-2.jpg',
        productUrl: 'https://www.lowes.com/p/1-2-PEX-Tubing-100ft',
        lat: 21.4152,
        lng: -157.9995
      },
      // Flooring
      {
        storeId: 'hd-1006',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: 'Luxury Vinyl Tile - 12\\"x12\\" - 10sqft',
        category: 'flooring',
        subcategory: 'luxury-vinyl',
        sku: '778899',
        upc: '041100077889',
        price: 29.99,
        unit: 'sqft',
        quantityAvailable: 50,
        inStock: true,
        imageUrl: 'https://example.com/images/lvt-12x12.jpg',
        productUrl: 'https://www.homedepot.com/p/Luxury-Vinyl-Tile-12x12-10sqft',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2006',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: 'Luxury Vinyl Tile - 12\\"x12\\" - 10sqft',
        category: 'flooring',
        subcategory: 'luxury-vinyl',
        sku: '889900',
        upc: '041100088990',
        price: 28.99,
        unit: 'sqft',
        quantityAvailable: 55,
        inStock: true,
        imageUrl: 'https://example.com/images/lvt-12x12.jpg',
        productUrl: 'https://www.lowes.com/p/Luxury-Vinyl-Tile-12x12-10sqft',
        lat: 21.4152,
        lng: -157.9995
      },
      // Walling
      {
        storeId: 'hd-1007',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: '1\\\" Rigid Foam Insulation - 4x8ft',
        category: 'walling',
        subcategory: 'insulation',
        sku: '998877',
        upc: '041100099887',
        price: 24.99,
        unit: 'sheet',
        quantityAvailable: 40,
        inStock: true,
        imageUrl: 'https://example.com/images/foam-insulation-4x8.jpg',
        productUrl: 'https://www.homedepot.com/p/1-Rigid-Foam-Insulation-4x8ft',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2007',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: '1\\\" Rigid Foam Insulation - 4x8ft',
        category: 'walling',
        subcategory: 'insulation',
        sku: '776655',
        upc: '041100077665',
        price: 23.99,
        unit: 'sheet',
        quantityAvailable: 45,
        inStock: true,
        imageUrl: 'https://example.com/images/foam-insulation-4x8.jpg',
        productUrl: 'https://www.lowes.com/p/1-Rigid-Foam-Insulation-4x8ft',
        lat: 21.4152,
        lng: -157.9995
      },
      // Tools
      {
        storeId: 'hd-1008',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        productName: '18V Cordless Drill - 2-Battery Kit',
        category: 'tools',
        subcategory: 'power-tools',
        sku: '11223344',
        upc: '04110001122344',
        price: 149.99,
        unit: 'each',
        quantityAvailable: 15,
        inStock: true,
        imageUrl: 'https://example.com/images/cordless-drill.jpg',
        productUrl: 'https://www.homedepot.com/p/18V-Cordless-Drill-2-Battery-Kit',
        lat: 21.3069,
        lng: -157.8583
      },
      {
        storeId: 'lowes-2008',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        productName: '18V Cordless Drill - 2-Battery Kit',
        category: 'tools',
        subcategory: 'power-tools',
        sku: '55667788',
        upc: '04110005566788',
        price: 139.99,
        unit: 'each',
        quantityAvailable: 20,
        inStock: true,
        imageUrl: 'https://example.com/images/cordless-drill.jpg',
        productUrl: 'https://www.lowes.com/p/18V-Cordless-Drill-2-Battery-Kit',
        lat: 21.4152,
        lng: -157.9995
      }
    ];

    this.mockProducts = baseProducts.map(product => ({
      ...product,
      id: `prod-${Math.random().toString(36).substr(2, 9)}`,
      lastUpdated: new Date()
    }));
  }

  private setupStoreProfiles(): void {
    // Group products by store for easier querying
    this.storeProfiles = {};
    this.mockProducts.forEach(product => {
      if (!this.storeProfiles[product.storeId]) {
        this.storeProfiles[product.storeId] = [];
      }
      this.storeProfiles[product.storeId].push(product);
    });
  }

  /**
   * Get all products from a specific store
   */
  async getProductsByStore(storeId: string): Promise<StoreProduct[]> {
    return this.storeProfiles[storeId] || [];
  }

  /**
   * Search products across all stores
   */
  async searchProducts(params: StoreSearchParams): Promise<StoreProduct[]> {
    const { query, category, zipCode, radius, maxPrice, minPrice, inStockOnly } = params;

    let results = this.mockProducts;

    // Filter based on search criteria
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p => 
        p.productName.toLowerCase().includes(lowerQuery) ||
        (p.category && p.category.toLowerCase().includes(lowerQuery))
      );
    }

    if (category) {
      results = results.filter(p => p.category === category);
    }

    if (inStockOnly) {
      results = results.filter(p => p.inStock);
    }

    if (maxPrice !== undefined) {
      results = results.filter(p => p.price <= maxPrice);
    }

    if (minPrice !== undefined) {
      results = results.filter(p => p.price >= minPrice);
    }

    // Filter by proximity to zip code (mock implementation)
    if (zipCode) {
      // Mock distance calculation - in real impl, use geolocation
      const mockZipDistances: Record<string, number> = {
        '96813': 0,    // Home base
        '96797': 1.2,  // Waipahu
        '96815': 0.8,  // Ala Moana
        '96701': 5.0,  // Downtown Honolulu
      };
      
      const userZipDist = mockZipDistances[zipCode] || 10;
      if (radius !== undefined && userZipDist > radius) {
        // Would filter by distance in real implementation
      }
    }

    // Sort by price (ascending by default)
    if (params.sortBy === 'price') {
      results.sort((a, b) => a.price - b.price);
    }

    return results;
  }

  /**
   * Get nearby stores based on zip code
   */
  async getNearbyStores(zipCode: string, radius: number = 10): Promise<any[]> {
    // Mock nearby stores
    return [
      {
        storeId: 'hd-1001',
        storeName: 'Home Depot - Downtown',
        storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        lat: 21.3069,
        lng: -157.8583,
        distance: 0.5,
      },
      {
        storeId: 'lowes-2001',
        storeName: "Lowe's - Waipahu",
        storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        lat: 21.4152,
        lng: -157.9995,
        distance: 1.2,
      },
      {
        storeId: 'ace-3001',
        storeName: 'Ace Hardware - Ala Moana',
        storeType: 'ace',
        address: { street: '789 Kani St', city: 'Honolulu', state: 'HI', zip: '96815', country: 'USA' },
        lat: 21.3001,
        lng: -157.8600,
        distance: 0.8,
      }
    ].filter(store => store.distance <= radius);
  }

  /**
   * Get user settings (mock implementation)
   */
  async getSettings(userId: string) {
    return {
      preferredStores: ['homeDepot', 'lowes'],
      priceVsDistancePriority: 0.5,
      taxRate: 0.05,
      defaultZip: '96813'
    };
  }

  /**
   * Update user settings (mock implementation)
   */
  async updateSettings(userId: string, settings: any) {
    return settings;
  }
}

export default new StoreDataProvider();