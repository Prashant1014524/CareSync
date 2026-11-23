import { useEffect, useRef } from 'react';

const clientId = import.meta.env.VITE_GOOGLE_SIGN_IN_CLIENT_ID;
let scriptReady;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!scriptReady) {
    scriptReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        const identity = window.google?.accounts?.id;
        if (identity) resolve(identity);
        else reject(new Error('Google sign-in is unavailable.'));
      };
      script.onerror = () => reject(new Error('Google sign-in could not load.'));
      document.head.append(script);
    }).catch(error => {
      scriptReady = undefined;
      throw error;
    });
  }
  return scriptReady;
}

export default function GoogleSignIn({ onCredential, onError }) {
  const container = useRef(null);
  const callbacks = useRef({ onCredential, onError });
  callbacks.current = { onCredential, onError };

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    const button = container.current;
    loadGoogleIdentity().then(identity => {
      if (!active) return;
      identity.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (active && credential) callbacks.current.onCredential(credential);
        },
      });
      identity.renderButton(button, { theme: 'outline', size: 'large', text: 'continue_with' });
    }).catch(error => {
      if (active) callbacks.current.onError(error.message);
    });
    return () => {
      active = false;
      button.replaceChildren();
    };
  }, []);

  return clientId ? <div ref={container} className="flex justify-center" /> : null;
}
