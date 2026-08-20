const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const client = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// Metrics
client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const productsGauge = new client.Gauge({
  name: 'products_total',
  help: 'Total number of products',
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  image: String,
  rating: Number,
  discount: { type: Number, default: 0 },
  stock: { type: Number, default: 100 },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// Seed data
async function seedProducts() {
  const count = await Product.countDocuments();
  if (count === 0) {
    const products = [
      { name: 'Samsung Galaxy S23 Ultra', price: 124999, category: 'Mobiles', rating: 4.5, discount: 15, image: 'https://via.placeholder.com/200', description: 'Samsung flagship' },
      { name: 'iPhone 15 Pro Max', price: 159900, category: 'Mobiles', rating: 4.7, discount: 10, image: 'https://via.placeholder.com/200', description: 'Apple flagship' },
      { name: 'Sony WH-1000XM5', price: 29990, category: 'Electronics', rating: 4.6, discount: 20, image: 'https://via.placeholder.com/200', description: 'Best headphones' },
      { name: 'MacBook Air M2', price: 119900, category: 'Laptops', rating: 4.8, discount: 12, image: 'https://via.placeholder.com/200', description: 'Apple laptop' },
      { name: 'Nike Air Max 270', price: 12995, category: 'Fashion', rating: 4.3, discount: 25, image: 'https://via.placeholder.com/200', description: 'Nike shoes' },
    ];
    await Product.insertMany(products);
    console.log('Products seeded');
  }
  productsGauge.set(await Product.countDocuments());
}

// Routes
app.get('/api/products/health', (req, res) => {
  res.json({ status: 'healthy', service: 'product-service' });
});

app.get('/api/products', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/products' });
  try {
    const { category } = req.query;
    const filter = category && category !== 'All' ? { category } : {};
    const products = await Product.find(filter);
    httpRequestsTotal.inc({ method: 'GET', route: '/api/products', status: 200 });
    end({ status: 200 });
    res.json(products);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/products', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/products/:id' });
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/products/:id', status: 404 });
      end({ status: 404 });
      return res.status(404).json({ error: 'Product not found' });
    }
    httpRequestsTotal.inc({ method: 'GET', route: '/api/products/:id', status: 200 });
    end({ status: 200 });
    res.json(product);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/products/:id', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/flipkart_products';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedProducts();
    app.listen(PORT, () => console.log(`Product service running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
