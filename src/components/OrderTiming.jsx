import { durationLabel, shopDateTime } from '../lib/preparation';
export default function OrderTiming({ order }) {
  return <div className="rounded-xl border bg-white p-4 my-4 text-sm space-y-2">
    <p><strong>Requested:</strong> {order.preferred_date || 'Not specified'} {order.preferred_time || ''} (Philippine time)</p>
    {order.preparation_minutes && <p><strong>Estimated work:</strong> {durationLabel(order.preparation_minutes)} — provisional</p>}
    <p><strong>Confirmed {order.delivery_method === 'delivery' ? 'delivery' : 'collection'} time:</strong> {shopDateTime(order.confirmed_ready_at)}</p>
    {order.timing_note && <p>{order.timing_note}</p>}
    {order.status === 'ready' ? <p className="font-bold text-green-800">{order.delivery_method === 'delivery' ? 'Prepared for dispatch. Contact the shop for delivery progress.' : 'Your order is ready for collection.'}</p> : order.status === 'cancelled' ? <p>Cancelled — any previous timing no longer applies.</p> : order.status !== 'completed' && <p>Please wait for the Ready status before collecting. Refresh tracking for the latest status.</p>}
  </div>;
}
