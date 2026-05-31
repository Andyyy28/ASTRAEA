import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../context/NotificationContext';
import { Eye, EyeOff, MessageSquareReply, Star, Trash2 } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
};

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const { showToast, showConfirm } = useNotifications();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('id, name, message, rating, is_displayed, admin_reply, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message || 'Could not load reviews.' });
    } else {
      setReviews(data || []);
      setReplyDrafts(Object.fromEntries((data || []).map(review => [review.id, review.admin_reply || ''])));
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-reviews-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(review => review.id !== payload.old?.id));
            setReplyDrafts(prev => {
              const next = { ...prev };
              delete next[payload.old?.id];
              return next;
            });
            return;
          }

          if (!payload.new?.id) return;
          setReviews(prev => {
            const exists = prev.some(review => review.id === payload.new.id);
            return exists
              ? prev.map(review => review.id === payload.new.id ? { ...review, ...payload.new } : review)
              : [payload.new, ...prev];
          });
          setReplyDrafts(prev => ({ ...prev, [payload.new.id]: payload.new.admin_reply || '' }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateReview = async (id, payload, successMessage) => {
    setSavingId(id);
    const { data, error } = await supabase
      .from('reviews')
      .update(payload)
      .eq('id', id)
      .select('id, name, message, rating, is_displayed, admin_reply, created_at')
      .single();

    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message || 'Could not update review.' });
    } else if (data) {
      setReviews(prev => prev.map(review => review.id === id ? data : review));
      setReplyDrafts(prev => ({ ...prev, [id]: data.admin_reply || '' }));
      showToast({ type: 'success', message: successMessage });
    }
    setSavingId(null);
  };

  const toggleDisplayed = (review) => {
    updateReview(
      review.id,
      { is_displayed: !review.is_displayed },
      review.is_displayed ? 'Review hidden from the Home page.' : 'Review is now visible on the Home page.'
    );
  };

  const saveReply = (review) => {
    const draft = replyDrafts[review.id]?.trim() || null;
    updateReview(review.id, { admin_reply: draft }, draft ? 'Reply saved.' : 'Reply removed.');
  };

  const deleteReview = async (review) => {
    const confirmed = await showConfirm({
      title: 'Delete review?',
      message: `This will permanently remove ${review.name}'s review.`,
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    setSavingId(review.id);
    const { error } = await supabase.from('reviews').delete().eq('id', review.id);
    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message || 'Could not delete review.' });
    } else {
      setReviews(prev => prev.filter(item => item.id !== review.id));
      showToast({ type: 'success', message: 'Review deleted.' });
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800">Customer Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">Moderate feedback shown on the Home page.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-64 bg-astraea-blush animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          <MessageSquareReply className="w-12 h-12 mx-auto text-astraea-pink/50 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">No reviews yet</h2>
          <p className="text-gray-500 mt-2">New customer feedback from the Contact page will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          {reviews.map((review) => (
            <article key={review.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-100 bg-[#FFFDFE] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-800 break-words">{review.name}</h2>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(review.created_at)}</p>
                  <div className="flex text-astraea-rosegold mt-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-5 h-5 ${star <= review.rating ? 'fill-current' : 'opacity-30'}`} />
                    ))}
                  </div>
                </div>
                <span className={`inline-flex items-center self-start rounded-full border-2 px-3 py-1 text-xs font-bold ${review.is_displayed ? 'bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]' : 'bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A]'}`}>
                  {review.is_displayed ? 'Displayed' : 'Hidden'}
                </span>
              </div>

              <div className="p-4 md:p-6 space-y-5">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{review.message}</p>

                <div>
                  <label className="block text-sm font-bold text-[#C4658A] mb-2">Admin Reply</label>
                  <textarea
                    rows="4"
                    value={replyDrafts[review.id] || ''}
                    onChange={(e) => setReplyDrafts(prev => ({ ...prev, [review.id]: e.target.value }))}
                    className="w-full rounded-xl border-2 border-[#F4BFCF] px-4 py-3 outline-none focus:border-[#F9A8C9] focus:ring-4 focus:ring-[#FDDDE6] resize-none"
                    placeholder="Write a reply for customers to see..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDisplayed(review)}
                    disabled={savingId === review.id}
                    className="kawaii-btn-outline flex-1 justify-center px-4 py-3 text-sm"
                  >
                    {review.is_displayed ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {review.is_displayed ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveReply(review)}
                    disabled={savingId === review.id}
                    className="kawaii-btn-primary flex-1 justify-center px-4 py-3 text-sm"
                  >
                    <MessageSquareReply className="w-4 h-4 mr-2" />
                    Save Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReview(review)}
                    disabled={savingId === review.id}
                    className="min-h-11 rounded-full border-2 border-[#F9A8C9] bg-[#FFF5F7] px-4 py-3 text-sm font-bold text-[#C4658A] hover:bg-[#FDDDE6] transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
