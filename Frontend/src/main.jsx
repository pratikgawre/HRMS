import { StrictMode } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { bootstrapData } from './utils/bootstrapData.js';
import { bootstrapSessionFromBackend } from './utils/appSession.js';

Promise.all([bootstrapSessionFromBackend(), bootstrapData()]).finally(() => {
  ReactDOMClient.createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});
