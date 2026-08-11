import { Component } from 'react';

/**
 * Catches render errors in a page so Navbar + routing keep working.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Clear error when route/path changes
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-error" style={{ padding: 24, textAlign: 'center' }}>
          <h3>This page hit an error</h3>
          <p style={{ opacity: 0.8, fontSize: 14 }}>
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            type="button"
            className="preset-btn"
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 12 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
