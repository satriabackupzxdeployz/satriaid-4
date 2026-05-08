import React, { useState, useEffect, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import Modal from './Modal';
import { useOrders } from '../hooks/useOrders';

const SITE_KEY = import.meta.env.VITE_CF_TURNSTILE_SITE_KEY || '0x4AAAAAADKkURAIh0TSp';

export default function CheckoutModal({ product, show, onClose }) {
  const [step, setStep] = useState('form');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [cfToken, setCfToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrisData, setQrisData] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState('pending');
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState('');
  const countdownRef = useRef(null);
  const { createOrder, listenToOrder } = useOrders();

  useEffect(() => {
    if (!show) {
      setStep('form');
      setPhone(''); setEmail(''); setMessage('');
      setCfToken(null);
      setQrisData(null); setOrderId(null);
      setOrderStatus('pending'); setError('');
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [show]);

  useEffect(() => {
    if (!orderId) return;
    const unsub = listenToOrder(orderId, (data) => {
      if (data.status === 'success') { setOrderStatus('success'); clearInterval(countdownRef.current); }
      else if (data.status === 'expired') { setOrderStatus('expired'); clearInterval(countdownRef.current); }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [orderId, listenToOrder]);

  async function handleProcess() {
    if (!cfToken) { setError('Selesaikan verifikasi Cloudflare terlebih dahulu.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: product.price,
          productName: product.name,
          turnstileToken: cfToken,
          seller: product.seller || 'Satriadevs',
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || 'Gagal membuat pembayaran.');
        setCfToken(null);
        setLoading(false); return;
      }
      const payData = json.data;
      setQrisData(payData);
      const expiryTime = payData.expiry_time
        ? new Date(payData.expiry_time).getTime()
        : Date.now() + 15 * 60 * 1000;
      setCountdown(Math.max(0, Math.floor((expiryTime - Date.now()) / 1000)));
      countdownRef.current = setInterval(() => {
        setCountdown(p => { if (p <= 1) { clearInterval(countdownRef.current); return 0; } return p - 1; });
      }, 1000);
      const oid = await createOrder({
        productId: product.id, productName: product.name,
        price: product.price, seller: product.seller || 'Satriadevs',
        orderId: payData.order_id || payData.orderId,
        phone: phone || null, email: email || null, buyerMessage: message || null,
        expiryTime, method: 'QRIS',
      });
      setOrderId(oid); setStep('qris');
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
      setCfToken(null);
    }
    setLoading(false);
  }

  const fmt = (s) => { if (s === null) return '--:--'; return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
  if (!product) return null;
  const priceF = 'Rp' + product.price.toLocaleString('id-ID');
  const iStyle = { width:'100%', padding:'.625rem .875rem', border:'1.5px solid #e5e7eb', borderRadius:'.625rem', fontSize:'.875rem', outline:'none', fontFamily:'inherit', background:'#fafafa', boxSizing:'border-box' };
  const lStyle = { display:'block', fontSize:'.8rem', fontWeight:600, color:'#374151', marginBottom:'.3rem' };

  return (
    <Modal show={show} onClose={onClose} maxWidth={500}>
      <div style={{ padding:'1.25rem 1.25rem .75rem', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'white', borderRadius:'1.5rem 1.5rem 0 0', zIndex:10 }}>
        <h2 style={{ fontSize:'1.25rem', fontWeight:900, color:'#1f2937' }}>🛒 Checkout</h2>
        <button onClick={onClose} style={{ width:40, height:40, borderRadius:'50%', background:'#f3f4f6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i className="fas fa-times" style={{ color:'#6b7280' }}></i>
        </button>
      </div>

      <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
        <div style={{ background:'#f0fdf4', borderRadius:'.75rem', padding:'1rem', display:'flex', alignItems:'center', gap:'.75rem' }}>
          <div style={{ width:48, height:48, borderRadius:'.5rem', background:'#bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="fas fa-shopping-cart" style={{ color:'#15803d' }}></i>
          </div>
          <div>
            <p style={{ fontSize:'.875rem', color:'#166534', fontWeight:600 }}>{product.name}</p>
            <p style={{ fontSize:'1.25rem', fontWeight:900, color:'#14532d' }}>{priceF}</p>
          </div>
        </div>

        {step === 'form' && (<>
          <div style={{ background:'#f9fafb', borderRadius:'.75rem', padding:'1rem', display:'flex', flexDirection:'column', gap:'.75rem', border:'1px solid #f3f4f6' }}>
            <p style={{ fontSize:'.8rem', fontWeight:700, color:'#374151', marginBottom:'.15rem' }}>
              <i className="fas fa-user-circle" style={{ color:'#6b7280', marginRight:'.35rem' }}></i>
              Data Pembeli <span style={{ color:'#9ca3af', fontWeight:400 }}>(opsional)</span>
            </p>
            <div><label style={lStyle}>No. Telepon / WhatsApp</label><input style={iStyle} type="tel" placeholder="Contoh: 081234567890" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
            <div><label style={lStyle}>Email</label><input style={iStyle} type="email" placeholder="Contoh: email@kamu.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div><label style={lStyle}>Pesan untuk Admin</label><textarea style={{ ...iStyle, resize:'vertical', minHeight:68 }} placeholder="Tulis pesan atau catatan untuk penjual..." value={message} onChange={e=>setMessage(e.target.value)} rows={3} /></div>
          </div>

          <div style={{ background:'#eff6ff', borderRadius:'.75rem', padding:'1rem', border:'1px solid #bfdbfe' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.25rem' }}>
              <i className="fas fa-qrcode" style={{ color:'#2563eb' }}></i>
              <span style={{ fontWeight:700, color:'#1e40af' }}>Metode: QRIS</span>
            </div>
            <p style={{ fontSize:'.75rem', color:'#3b82f6' }}>Scan kode QRIS setelah menekan tombol di bawah. Berlaku <strong>15 menit</strong>.</p>
          </div>

          <div>
            <p style={{ fontSize:'.75rem', color:'#6b7280', marginBottom:'.5rem' }}>Selesaikan verifikasi untuk melanjutkan:</p>
            <div style={{ display:'flex', justifyContent:'flex-start' }}>
              <Turnstile
                siteKey={SITE_KEY}
                onSuccess={(token) => setCfToken(token)}
                onExpire={() => setCfToken(null)}
                onError={() => setCfToken(null)}
                options={{ theme: 'light' }}
              />
            </div>
            {!cfToken && (
              <p style={{ fontSize:'.7rem', color:'#9ca3af', marginTop:'.35rem' }}>
                <i className="fas fa-spinner fa-spin" style={{ marginRight:'.3rem' }}></i>
                Memuat verifikasi Cloudflare...
              </p>
            )}
          </div>

          {error && <p style={{ color:'#dc2626', fontSize:'.875rem', textAlign:'center' }}>{error}</p>}

          <button
            className="btn-primary"
            style={{ width:'100%', padding:'.875rem', fontSize:'1rem', opacity: cfToken && !loading ? 1 : 0.6 }}
            onClick={handleProcess}
            disabled={!cfToken || loading}
          >
            {loading ? <><i className="fas fa-spinner fa-spin"></i> Memproses...</> : <><i className="fas fa-qrcode"></i> Proses QRIS</>}
          </button>
        </>)}

        {step === 'qris' && (<>
          {orderStatus === 'success' ? (
            <div style={{ textAlign:'center', padding:'2rem 1rem' }}>
              <i className="fas fa-check-circle animate-checkmark" style={{ fontSize:'3rem', color:'#22c55e', marginBottom:'1rem', display:'block' }}></i>
              <p style={{ fontSize:'1.125rem', fontWeight:700, color:'#15803d' }}>Pembayaran Berhasil!</p>
              <p style={{ color:'#4b7c4b', fontSize:'.875rem', marginTop:'.5rem' }}>Terima kasih sudah membeli {product.name} 🙏</p>
              {product.fileUrl && <a href={product.fileUrl} target="_blank" rel="noreferrer" className="btn-download" style={{ marginTop:'1.25rem', width:'100%', justifyContent:'center' }}><i className="fas fa-download"></i> Download Produk</a>}
            </div>
          ) : orderStatus === 'expired' ? (
            <div style={{ textAlign:'center', padding:'2rem 1rem' }}>
              <i className="fas fa-hourglass-end" style={{ fontSize:'3rem', color:'#ef4444', marginBottom:'1rem', display:'block' }}></i>
              <p style={{ fontSize:'1.125rem', fontWeight:700, color:'#dc2626' }}>Pembayaran Kadaluarsa</p>
              <p style={{ color:'#6b7280', fontSize:'.875rem', marginTop:'.5rem' }}>Waktu pembayaran habis. Silakan coba lagi.</p>
              <button className="btn-primary" style={{ marginTop:'1.25rem', width:'100%' }} onClick={onClose}>Tutup & Coba Lagi</button>
            </div>
          ) : (<>
            <div style={{ border:'2px dashed #22c55e', borderRadius:'.75rem', padding:'1.5rem', textAlign:'center', background:'#f0fdf4' }}>
              <h3 style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:'.75rem' }}>Scan QRIS</h3>
              {qrisData?.qr_url
                ? <img src={qrisData.qr_url} alt="QRIS" style={{ width:176, height:176, margin:'0 auto', borderRadius:'.5rem', display:'block' }} onContextMenu={e=>e.preventDefault()} draggable={false} />
                : <svg viewBox="0 0 200 200" fill="none" style={{ width:176, height:176, margin:'0 auto', display:'block' }}><rect x="20" y="20" width="160" height="160" rx="16" fill="white" stroke="#29b77d" strokeWidth="3"/><rect x="35" y="35" width="45" height="45" rx="8" fill="#29b77d"/><rect x="120" y="35" width="45" height="45" rx="8" fill="#29b77d"/><rect x="35" y="120" width="45" height="45" rx="8" fill="#29b77d"/><circle cx="100" cy="100" r="14" fill="#29b77d" opacity=".8"/><circle cx="100" cy="100" r="6" fill="white"/></svg>
              }
              <p style={{ fontSize:'.875rem', color:'#15803d', fontWeight:600, marginTop:'.75rem' }}>QRIS — {product.name}</p>
              <p style={{ fontSize:'.75rem', color:'#6b7280' }}>Scan dengan e-wallet / mobile banking</p>
            </div>
            {qrisData?.order_id && <div style={{ background:'#f9fafb', borderRadius:'.75rem', padding:'.75rem 1rem', fontSize:'.8rem' }}><div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#6b7280' }}>Order ID</span><span style={{ fontFamily:'monospace', fontWeight:700 }}>{qrisData.order_id}</span></div></div>}
            <div style={{ background:'#fffbeb', borderRadius:'.75rem', padding:'1rem', textAlign:'center', border:'1px solid #fde68a' }}>
              <p style={{ fontSize:'.75rem', color:'#b45309', marginBottom:'.25rem' }}><i className="fas fa-hourglass-half" style={{ marginRight:'.25rem' }}></i> Sisa waktu pembayaran:</p>
              <p className={`qris-countdown ${countdown !== null && countdown < 60 ? 'countdown-warning':''}`} style={{ color:'#b45309' }}>{fmt(countdown)}</p>
            </div>
            <p style={{ fontSize:'.75rem', color:'#3b82f6', background:'#eff6ff', padding:'.75rem', borderRadius:'.75rem' }}>
              <i className="fas fa-info-circle" style={{ marginRight:'.25rem' }}></i>
              Menunggu konfirmasi pembayaran... Status berubah otomatis setelah transfer berhasil.
            </p>
          </>)}
        </>)}
      </div>
    </Modal>
  );
}
