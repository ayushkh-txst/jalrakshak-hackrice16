import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './features/dashboard/route-analysis-enhancer';
import './features/dashboard/route-comparison-map.css';
import './features/dashboard/alerts-enhancer';
import './features/dashboard/alerts-enhancer.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
