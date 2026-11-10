import { Component } from "react";
export default class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page ws-page" role="alert">
        <h1>This page couldn’t load.</h1>
        <p>
          Check your connection and reload the page. Your saved records are
          still available.
        </p>
        <div className="ws-inline">
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
          <a className="btn btn-secondary" href="/">
            Go to Home
          </a>
        </div>
      </main>
    );
  }
}
