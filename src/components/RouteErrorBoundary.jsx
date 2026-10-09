import React from 'react';

export default class RouteErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-astraea-darkgray">
        <h1 className="section-heading text-2xl mb-4">This page could not load</h1>
        <p role="alert" className="mb-6">Check your connection and reload. Your saved cart and pending checkout recovery details will be retained.</p>
        <button type="button" className="kawaii-btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </main>
    );
  }
}
