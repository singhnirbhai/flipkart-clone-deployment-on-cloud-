const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const client = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

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

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: { name: String, phone: String, pincode: String, address: String, city: String, state: String },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Routes
app.get('/api/users/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

app.post('/api/users/register', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'POST', route: '/api/users/register' });
  try {
    const user = new User(req.body);
    await user.save();
    httpRequestsTotal.inc({ method: 'POST', route: '/api/users/register', status: 201 });
    end({ status: 201 });
    res.status(201).json({ message: 'User registered', user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    httpRequestsTotal.inc({ method: 'POST', route: '/api/users/register', status: 400 });
    end({ status: 400 });
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'POST', route: '/api/users/login' });
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      httpRequestsTotal.inc({ method: 'POST', route: '/api/users/login', status: 401 });
      end({ status: 401 });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    httpRequestsTotal.inc({ method: 'POST', route: '/api/users/login', status: 200 });
    end({ status: 200 });
    res.json({ message: 'Login successful', user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    httpRequestsTotal.inc({ method: 'POST', route: '/api/users/login', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/users/:id' });
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/users/:id', status: 404 });
      end({ status: 404 });
      return res.status(404).json({ error: 'User not found' });
    }
    httpRequestsTotal.inc({ method: 'GET', route: '/api/users/:id', status: 200 });
    end({ status: 200 });
    res.json(user);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/users/:id', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/flipkart_users';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`User service running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
