export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const payload = req.body;
  const orderId = payload.order_id || payload.orderId;
  const status = payload.status || payload.payment_status;

  if (!orderId) return res.status(400).json({ message: 'Missing order_id' });

  const isPaid = ['success', 'paid', 'PAID', 'SUCCESS'].includes(status);
  const isExpired = ['expired', 'EXPIRED', 'cancelled', 'CANCELLED', 'failed', 'FAILED'].includes(status);

  const newStatus = isPaid ? 'success' : isExpired ? 'expired' : 'pending';

  const DB_URL = process.env.VITE_FIREBASE_DATABASE_URL;
  const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET;

  if (!DB_URL) return res.status(500).json({ message: 'Database URL not configured' });

  try {
    const authParam = DB_SECRET ? `?auth=${DB_SECRET}` : '';
    const firebaseRes = await fetch(
      `${DB_URL}/orders/${orderId}.json${authParam}`,
      { method: 'GET' }
    );
    const orderData = await firebaseRes.json();

    if (!orderData || orderData.error) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await fetch(
      `${DB_URL}/orders/${orderId}.json${authParam}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          updatedAt: Date.now(),
          webhookPayload: payload,
        }),
      }
    );

    return res.status(200).json({ success: true, orderId, newStatus });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
