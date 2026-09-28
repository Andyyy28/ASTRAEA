import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Link as LinkIcon } from 'lucide-react';
import { publicSiteUrl } from '../../lib/siteUrl';

export default function Share() {
  const url = publicSiteUrl(import.meta.env.VITE_PUBLIC_SITE_URL || undefined);
  const [qr, setQr] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (url) QRCode.toDataURL(url, { width: 768, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#252025', light: '#ffffff' } })
      .then(value => { if (active) setQr(value); })
      .catch(() => { if (active) setMessage('Could not generate the QR code. Use the link below.'); });
    return () => { active = false; };
  }, [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMessage('Website link copied.'); }
    catch { setMessage('Copy the website address shown below.'); }
  };
  return <section className="max-w-xl mx-auto px-4 py-12 text-center">
    <h1 className="section-heading text-3xl mb-4">Scan, design, enjoy</h1>
    <p>Open Astraea Collection on your phone to browse flowers and create your own bouquet.</p>
    {url ? <>
      {qr && <img src={qr} alt={`QR code for ${url}`} width="320" height="320" className="mx-auto my-6 rounded-xl border bg-white" />}
      <a href={url} className="block break-all underline mb-6">{url}</a>
      <div className="flex flex-wrap justify-center gap-3">
        {qr && <a href={qr} download="astraea-website-qr.png" className="kawaii-btn-primary"><Download size={18} className="mr-2" />Download QR</a>}
        <button type="button" onClick={copy} className="kawaii-btn-outline"><LinkIcon size={18} className="mr-2" />Copy link</button>
      </div>
      <p className="text-sm mt-6">Print this code for your counter, packaging or cards. It opens the storefront; it is not a payment QR code.</p>
    </> : <p role="alert" className="mt-6">A valid public website address must be configured before sharing.</p>}
    <p role="status" className="mt-4">{message}</p>
  </section>;
}
