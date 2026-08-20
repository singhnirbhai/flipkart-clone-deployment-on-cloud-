const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const client = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// ====== METRICS FOR HPA ======
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

// Custom metric for HPA - tracks active payment processing load
const activePaymentsGauge = new client.Gauge({
  name: 'payment_active_processing',
  help: 'Number of payments currently being processed',
});

const paymentSuccessCounter = new client.Counter({
  name: 'payment_success_total',
  help: 'Total successful payments',
});

const paymentFailureCounter = new client.Counter({
  name: 'payment_failure_total',
  help: 'Total failed payments',
});

const paymentAmountHistogram = new client.Histogram({
  name: 'payment_amount_inr',
  help: 'Payment amounts in INR',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 200000],
});

const cpuUsageGauge = new client.Gauge({
  name: 'nodejs_cpu_usage_percent',
  help: 'CPU usage percentage of payment service',
});

// Simulate CPU metric collection
setInterval(() => {
  const usage = process.cpuUsage();
  const cpuPercent = ((usage.user + usage.system) / 1000000) * 100;
  cpuUsageGauge.set(Math.min(cpuPercent, 100));
}, 5000);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Payment Schema
const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['upi', 'card', 'netbanking', 'cod'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  transactionId: String,
  upiId: String,
  cardLast4: String,
  bank: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);

// ====== HEALTH CHECK (used by HPA) ======
app.get('/api/payments/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payment-service',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activePayments: activePaymentsGauge.hashMap ? 0 : 0,
  });
});

// ====== PROCESS PAYMENT (main endpoint that triggers HPA) ======
app.post('/api/payments/process', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'POST', route: '/api/payments/process' });
  activePaymentsGauge.inc();

  try {
    const { orderId, userId, amount, method, upiId, cardNumber, bank } = req.body;

    const payment = new Payment({
      orderId,
      userId,
      amount,
      method,
      status: 'processing',
      upiId,
      cardLast4: cardNumber ? cardNumber.slice(-4) : undefined,
      bank,
    });

    await payment.save();

    // Simulate payment processing (real payment gateway would be called here)
    // Higher amounts take longer to process (simulates real-world load)
    const processingTime = Math.min(500 + (amount / 1000) * 10, 5000);

    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // 95% success rate simulation
    const isSuccess = Math.random() < 0.95;

    if (isSuccess) {
      payment.status = 'completed';
      payment.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      await payment.save();

      paymentSuccessCounter.inc();
      paymentAmountHistogram.observe(amount);

      httpRequestsTotal.inc({ method: 'POST', route: '/api/payments/process', status: 200 });
      end({ status: 200 });

      res.json({
        success: true,
        transactionId: payment.transactionId,
        amount: payment.amount,
        method: payment.method,
        status: 'completed',
      });
    } else {
      payment.status = 'failed';
      await payment.save();

      paymentFailureCounter.inc();
      httpRequestsTotal.inc({ method: 'POST', route: '/api/payments/process', status: 500 });
      end({ status: 500 });

      res.status(500).json({ success: false, error: 'Payment processing failed' });
    }
  } catch (err) {
    paymentFailureCounter.inc();
    httpRequestsTotal.inc({ method: 'POST', route: '/api/payments/process', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  } finally {
    activePaymentsGauge.dec();
  }
});

// ====== CHECK PAYMENT STATUS ======
app.get('/api/payments/:orderId', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/payments/:orderId' });
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId });
    if (!payment) {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/payments/:orderId', status: 404 });
      end({ status: 404 });
      return res.status(404).json({ error: 'Payment not found' });
    }
    httpRequestsTotal.inc({ method: 'GET', route: '/api/payments/:orderId', status: 200 });
    end({ status: 200 });
    res.json(payment);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/payments/:orderId', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

// ====== STRESS ENDPOINT (for testing HPA) ======
app.get('/api/payments/stress', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/payments/stress' });
  activePaymentsGauge.inc();

  // Simulate CPU-intensive operation
  const iterations = 1000000;
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }

  activePaymentsGauge.dec();
  httpRequestsTotal.inc({ method: 'GET', route: '/api/payments/stress', status: 200 });
  end({ status: 200 });

  res.json({ result, message: 'Stress test completed' });
});

// ====== PAYMENT HISTORY ======
app.get('/api/payments/user/:userId', async (req, res) => {
  const end = httpRequestDuration.startTimer({ method: 'GET', route: '/api/payments/user/:userId' });
  try {
    const payments = await Payment.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    httpRequestsTotal.inc({ method: 'GET', route: '/api/payments/user/:userId', status: 200 });
    end({ status: 200 });
    res.json(payments);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/payments/user/:userId', status: 500 });
    end({ status: 500 });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/flipkart_payments';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Payment service running on port ${PORT}`);
      console.log('HPA-ready: exposes /metrics endpoint with CPU, active payments, and custom metrics');
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
