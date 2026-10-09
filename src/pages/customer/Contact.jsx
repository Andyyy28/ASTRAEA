import React, { useEffect, useState } from 'react';
import { Mail, MessageCircle, Clock, Globe, AtSign, Video, Check, Phone, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TurnstileWidget from '../../components/TurnstileWidget';

const Contact = () => {
  const draftKey = 'astraea_review_draft';
  const [formData, setFormData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      return saved && typeof saved === 'object' ? { name: String(saved.name || '').slice(0, 120), message: String(saved.message || '').slice(0, 2000), rating: Number.isInteger(Number(saved.rating)) && Number(saved.rating) >= 1 && Number(saved.rating) <= 5 ? Number(saved.rating) : 5 } : { name: '', message: '', rating: 5 };
    } catch { return { name: '', message: '', rating: 5 }; }
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const heartIcon = String.fromCodePoint(9825);
  const flowerIcon = String.fromCodePoint(10047);
  const starIcon = String.fromCodePoint(9733);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(formData)); } catch { /* draft persistence is best effort */ }
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!turnstileToken) {
      setError('Please complete the security check.');
      return;
    }
    setLoading(true);

    try {
      const { error: submitError } = await supabase.functions.invoke('guest-api', {
        body: { action: 'review', turnstile_token: turnstileToken, name: formData.name.trim(), message: formData.message.trim(), rating: Number(formData.rating) }
      });
      if (submitError) throw submitError;
      setSubmitted(true);
      setFormData({ name: '', message: '', rating: 5 });
      try { localStorage.removeItem(draftKey); } catch { /* ignore storage failures */ }
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your review. Please try again.');
    } finally {
      setLoading(false);
      setTurnstileToken('');
      setTurnstileKey(key => key + 1);
    }
  };

  const renderRatingInput = () => (
    <div>
      <span className="block text-sm font-medium text-[#C4658A] mb-2">Star Rating</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, rating }))}
            className="min-h-11 min-w-11 rounded-full bg-white border-2 border-dashed border-astraea-pink/40 flex items-center justify-center text-astraea-rosegold hover:bg-astraea-blush/40 transition-colors"
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          >
            <Star className={`w-5 h-5 ${rating <= formData.rating ? 'fill-current' : 'opacity-30'}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="py-8 md:py-16 bg-astraea-cream min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h1 className="section-heading text-2xl md:text-4xl mb-4">Get in Touch</h1>
          <p className="font-accent text-2xl text-astraea-rosegold">We'd love to hear from you. Send us a message or reach out on Messenger.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-0 bg-[#FFFDFE] rounded-3xl shadow-[4px_4px_0px_#F9A8C9] border-2 border-dashed border-astraea-pink overflow-hidden">
          <div className="lg:w-1/2 p-4 md:p-12 order-2 lg:order-1">
            <h2 className="section-heading text-xl md:text-3xl mb-8">{flowerIcon} Customer Reviews & Feedback</h2>
            {submitted ? (
              <div className="scrapbook-card bg-astraea-mint/30 text-[#2D7A5F] text-center animate-fade-in">
                <div className="w-16 h-16 bg-astraea-mint rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#A8DFC9]"><Check className="w-8 h-8 text-[#2D7A5F]" /></div>
                <h3 className="font-bold text-xl mb-2">Review Submitted!</h3>
                <p>Thank you for sharing your feedback. It will appear on the Home page after admin approval.</p>
                <button onClick={() => setSubmitted(false)} className="kawaii-btn-outline mt-6">Leave Another Review</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
                    {error}
                  </div>
                )}
                <div><label htmlFor="review-name" className="block text-sm font-medium text-[#C4658A] mb-2">Full Name</label><input id="review-name" type="text" maxLength={120} required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="kawaii-input" placeholder="Jane Doe" /></div>
                <div><label htmlFor="review-message" className="block text-sm font-medium text-[#C4658A] mb-2">Review / Feedback</label><textarea id="review-message" rows="5" maxLength={2000} required value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="kawaii-input min-h-[100px] resize-none" placeholder="Tell us about your Astraea experience."></textarea></div>
                {renderRatingInput()}
                <TurnstileWidget key={turnstileKey} action="review" onToken={setTurnstileToken} onError={() => { setTurnstileToken(''); setError('Security check unavailable. Please try again.'); }} />
                <button type="submit" disabled={loading} className="kawaii-btn-primary w-full py-4 text-lg">{loading ? 'Submitting...' : 'Submit Review'}</button>
              </form>
            )}
          </div>
          <div className="lg:w-1/2 p-4 md:p-12 bg-astraea-blush/30 lg:border-l-2 lg:border-dashed border-astraea-pink order-1 lg:order-2">
            <h2 className="section-heading text-xl md:text-3xl mb-8">{starIcon} Contact Information</h2>
            <div className="space-y-8">
              <div className="scrapbook-card bg-white/90 text-center">
                <MessageCircle className="w-10 h-10 text-astraea-pink mb-4 mx-auto" />
                <h3 className="font-bold text-lg mb-2">Quickest Reply</h3>
                <a href="https://www.facebook.com/share/18yY1YAP5n/" target="_blank" rel="noreferrer" className="kawaii-btn w-full justify-center mt-2 bg-[#E8F0FE] border-[#A8C0F8] text-[#1A56DB]">Chat on Messenger {heartIcon}</a>
                <a href="tel:09071757540" className="kawaii-btn w-full justify-center mt-3 bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]">Call Us {heartIcon}</a>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start"><Phone className="w-6 h-6 text-astraea-pink mr-4 shrink-0" /><div><h4 className="font-bold">Phone Number</h4><p className="text-astraea-darkgray/70">09071757540</p></div></li>
                <li className="flex items-start"><Mail className="w-6 h-6 text-astraea-pink mr-4 shrink-0" /><div><h4 className="font-bold">Email Address</h4><p className="text-astraea-darkgray/70">rjean4393@gmail.com</p></div></li>
                <li className="flex items-start"><Clock className="w-6 h-6 text-astraea-pink mr-4 shrink-0" /><div><h4 className="font-bold">Business Hours</h4><p className="text-astraea-darkgray/70">Monday - Saturday: 9:00 AM - 7:00 PM</p><p className="text-astraea-darkgray/70">Sunday: 10:00 AM - 5:00 PM</p></div></li>
              </ul>
              <div className="pt-6 border-t-2 border-dashed border-astraea-pink/30">
                <h4 className="font-bold mb-4">Follow Us</h4>
                <div className="flex gap-4">
                  <a aria-label="Astraea Collection Facebook page" href="https://www.facebook.com/share/1RzvhQpxG1/" target="_blank" rel="noreferrer" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-dashed border-astraea-pink/40 hover:text-astraea-pink transition-colors shadow-[3px_3px_0px_#F9A8C9]"><Globe className="w-6 h-6" /></a>
                  <a aria-label="Astraea Collection Messenger" href="https://www.facebook.com/share/18yY1YAP5n/" target="_blank" rel="noreferrer" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-dashed border-astraea-pink/40 hover:text-astraea-pink transition-colors shadow-[3px_3px_0px_#F9A8C9]"><AtSign className="w-6 h-6" /></a>
                  <a aria-label="Video chat with Astraea Collection" href="https://www.facebook.com/share/18yY1YAP5n/" target="_blank" rel="noreferrer" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-dashed border-astraea-pink/40 hover:text-astraea-pink transition-colors shadow-[3px_3px_0px_#F9A8C9]"><Video className="w-6 h-6" /></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
