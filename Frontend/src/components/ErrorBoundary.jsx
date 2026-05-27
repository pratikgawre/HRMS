import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Kavya HRMS crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-page">
          <section>
            <span>K</span>
            <h1>Kavya HRMS could not load</h1>
            <p>{this.state.error.message || 'A browser runtime error occurred.'}</p>
            <button onClick={() => window.location.reload()}>Reload app</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
