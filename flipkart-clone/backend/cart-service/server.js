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

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Cart Schema
const cartItemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: String, required: true },
  name: String,
  price: Number,
  image: String,
  qty: { type: Number, default: 1 },
}, { timestamps: true });

const CartItem = mongoose.model('CartItem', cartItemSchema);

// Routes
app.get('/api/cart/health', (req, res) => {
  res.json({ status: 'healthy', service: 'cart-service' });
});

app.get('/api/cart/:userId', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/cart/:userId' });
  try {
    const items = await CartItem.find({ userId: req.params.userId });
    httpRequestsTotal.inc({ method: 'GET', route: '/api/cart/:userId', status: 200 });
    end({ status: 200 });
    res.json(items);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/cart/:userId', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'POST', route: '/api/cart' });
  try {
    const { userId, productId, name, price, image, qty } = req.body;
    let item = await CartItem.findOne({ userId, productId });
    if (item) {
      item.qty += qty || 1;
      await item.save();
    } else {
      item = new CartItem({ userId, productId, name, price, image, qty: qty || 1 });
      await item.save();
    }
    httpRequestsTotal.inc({ method: 'POST', route: '/api/cart', status: 201 });
    end({ status: 201 });
    res.status(201).json(item);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'POST', route: '/api/cart', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cart/:id', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'PUT', route: '/api/cart/:id' });
  try {
    const item = await CartItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) {
      end({ status: 404 });
      return res.status(404).json({ error: 'Item not found' });
    }
    end({ status: 200 });
    res.json(item);
  } catch (err) {
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cart/:id', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'DELETE', route: '/api/cart/:id' });
  try {
    await CartItem.findByIdAndDelete(req.params.id);
    end({ status: 200 });
    res.json({ message: 'Item removed' });
  } catch (err) {
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/flipkart_cart';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Cart service running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
