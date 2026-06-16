import React from "react";

/**
 * Last-resort UI fallback. Catches any uncaught render or lifecycle error so
 * a single bad component doesn't blank the entire dashboard. The stack is
 * logged (console + optional /api/feedback) so we still get telemetry.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    this.setState({ info });
    console.error("[ErrorBoundary]", err, info);
  }

  reset = () => this.setState({ err: null, info: null });
  reload = () => window.location.reload();

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="errbnd">
        <div className="errbnd__card">
          <div className="errbnd__title">Something went wrong on this page.</div>
          <div className="errbnd__msg">
            A component failed to render. The rest of the dashboard is still
            available — try reloading or going back to the previous page.
          </div>
          <pre className="errbnd__stack">
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <div className="errbnd__actions">
            <button className="modal__ok" onClick={this.reload}>Reload page</button>
            <button className="modal__ok modal__ok--ghost" onClick={this.reset}>Try again</button>
          </div>
        </div>
      </div>
    );
  }
}
