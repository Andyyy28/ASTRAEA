import React from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

const NotFound = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
    <SearchX className="mb-4 h-16 w-16 text-astraea-pink" aria-hidden="true" />
    <h1 className="font-heading text-3xl font-bold text-astraea-darkgray">Page not found</h1>
    <p className="mt-2 max-w-md text-astraea-darkgray/70">That page does not exist or may have moved.</p>
    <Link to="/" className="kawaii-btn-primary mt-6 px-6 py-3">Back to home</Link>
  </div>
);

export default NotFound;
