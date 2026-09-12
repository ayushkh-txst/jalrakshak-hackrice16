import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './features/dashboard/route-analysis-enhancer';
import './features/dashboard/route-comparison-map.css';
import './features/dashboard/alerts-enhancer';
import './features/dashboard/alerts-enhancer.css';
import './features/dashboard/ai-assistant-enhancer';
import './features/dashboard/ai-assistant-enhancer.css';
import './features/dashboard/navcat-branding';
import './features/dashboard/navcat-branding.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
