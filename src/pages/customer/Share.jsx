import { useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';

const storefront = 'https://astraeacollection.vercel.app/';

export default function Share() {
  const { key } = useLocation();

  useLayoutEffect(() => {
    // Footer navigation must reveal the QR instead of retaining the old scroll position.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [key]);

  return <section className="max-w-xl mx-auto px-4 py-12 text-center">
    <h1 className="section-heading text-3xl mb-4">Scan, design, enjoy</h1>
    <p>Scan this code to open Astraea Collection on your phone, browse flowers and create a bouquet.</p>
    <img src="/astraea-website-qr.png" alt={`QR code linking to ${storefront}`} width="320" height="320" className="skeuo-surface mx-auto my-6 rounded-xl border bg-white" />
    <a href={storefront} className="block break-all underline mb-6">{storefront}</a>
    <div className="flex flex-wrap justify-center gap-3">
      <a href="/astraea-website-qr.png" download="astraea-website-qr.png" className="kawaii-btn-primary"><Download size={18} className="mr-2" />Download QR</a>
      <Link to="/customize" className="kawaii-btn-outline">Design a bouquet</Link>
    </div>
    <p className="text-sm mt-6">Print the code for your counter, packaging or cards. It opens the storefront; it is not a payment QR code.</p>
  </section>;
}
