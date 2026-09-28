import { Clock } from 'lucide-react';
import { estimateOrder, durationLabel } from '../lib/preparation';

export default function PreparationEstimate({ items }) {
  const minutes = estimateOrder(items);
  return <aside className="rounded-2xl border border-astraea-rosegold/40 bg-white p-4 mb-6 text-astraea-darkgray" aria-live="polite">
    <h2 className="font-bold flex items-center gap-2"><Clock size={20} /> Estimated preparation: {durationLabel(minutes)}</h2>
    <p className="text-sm mt-2">More stems, flower varieties, fillers and add-ons take more time. Multiple bouquets are estimated together.</p>
    <p className="text-sm mt-2">Provisional estimate only. Staff must confirm your requested time after checking the design, stock, queue and opening hours. Delivery travel time is additional. Wait for the Ready status before collecting.</p>
  </aside>;
}
