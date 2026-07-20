import { StrictMode } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { bootstrapData } from './utils/bootstrapData.js';
import { bootstrapSessionFromBackend, getSessionSnapshot } from './utils/appSession.js';

const cachedSession = getSessionSnapshot();
const sessionBootstrap = bootstrapSessionFromBackend().catch(() => cachedSession);

sessionBootstrap
  .then((session) => {
    const hasActiveSession = Boolean(session?.kavyaRole || session?.kavyaAccessRole);
    if (!hasActiveSession) {
      return null;
    }

    return bootstrapData().catch(() => null);
  })
  .catch(() => null)
  .finally(() => {
    ReactDOMClient.createRoot(document.getElementById('root')).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
