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

const ordersGauge = new client.Gauge({
  name: 'orders_total',
  help: 'Total number of orders',
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{
    productId: String,
    name: String,
    price: Number,
    qty: Number,
    image: String,
  }],
  address: {
    name: String,
    phone: String,
    pincode: String,
    address: String,
    city: String,
    state: String,
  },
  totalAmount: Number,
  paymentMethod: String,
  paymentStatus: { type: String, default: 'pending' },
  orderStatus: { type: String, enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'placed' },
  transactionId: String,
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// Routes
app.get('/api/orders/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

app.post('/api/orders', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'POST', route: '/api/orders' });
  try {
    const order = new Order({
      ...req.body,
      orderStatus: 'placed',
      paymentStatus: 'pending',
    });
    await order.save();
    ordersGauge.set(await Order.countDocuments());
    httpRequestsTotal.inc({ method: 'POST', route: '/api/orders', status: 201 });
    end({ status: 201 });
    res.status(201).json({ message: 'Order placed', orderId: order._id, order });
  } catch (err) {
    httpRequestsTotal.inc({ method: 'POST', route: '/api/orders', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/orders/:userId' });
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    httpRequestsTotal.inc({ method: 'GET', route: '/api/orders/:userId', status: 200 });
    end({ status: 200 });
    res.json(orders);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/orders/:userId', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/orders' });
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
    httpRequestsTotal.inc({ method: 'GET', route: '/api/orders', status: 200 });
    end({ status: 200 });
    res.json(orders);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/orders', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3005;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/flipkart_orders';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Order service running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
