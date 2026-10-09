import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { supabaseConfigReady } from './lib/supabase';

const root = document.getElementById('root');
const ConfigError = () => <div style={{ padding: '2rem', fontFamily: 'system-ui', color: '#3D2C35' }}><h1>Store configuration is incomplete</h1><p>Set the Supabase browser URL and anonymous key before starting the storefront.</p></div>;

createRoot(root).render(
  <StrictMode>
    {supabaseConfigReady ? <App /> : <ConfigError />}
  </StrictMode>,
)
