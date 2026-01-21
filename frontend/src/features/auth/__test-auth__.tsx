// src/features/auth/__test-auth__.tsx
// Simple test component to verify auth functionality
// Add this to a route temporarily to test login/signup/logout

import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useLogin } from './hooks/useLogin';
import { useSignup } from './hooks/useSignup';
import { useLogout } from './hooks/useLogout';

/**
 * Test credentials (provided by user):
 * Email: boris@test.com
 * Password: test123
 * Name: Boris Test
 */
export default function AuthTest() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const logoutMutation = useLogout();

  const [email, setEmail] = useState(import.meta.env.VITE_TEST_USER_EMAIL || 'boris@test.com');
  const [password, setPassword] = useState(import.meta.env.VITE_TEST_USER_PASSWORD || 'test123');
  const [name, setName] = useState(import.meta.env.VITE_TEST_USER_NAME || 'Boris Test');

  const handleLogin = () => {
    loginMutation.mutate({ email, password });
  };

  const handleSignup = () => {
    signupMutation.mutate({ email, password, name });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading auth state...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Auth Test Component</h1>

      {/* Auth Status */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f0f0', borderRadius: '4px' }}>
        <h2>Auth Status</h2>
        <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
        <p><strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'None'}</p>
      </div>

      {/* Login Form */}
      {!isAuthenticated && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Login</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button
              onClick={handleLogin}
              disabled={loginMutation.isPending}
              style={{
                padding: '0.5rem 1rem',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {loginMutation.isPending ? 'Logging in...' : 'Login'}
            </button>
            {loginMutation.isError && (
              <div style={{ color: 'red' }}>
                Error: {loginMutation.error?.message || 'Login failed'}
              </div>
            )}
            {loginMutation.isSuccess && (
              <div style={{ color: 'green' }}>Login successful!</div>
            )}
          </div>
        </div>
      )}

      {/* Signup Form */}
      {!isAuthenticated && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Signup</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button
              onClick={handleSignup}
              disabled={signupMutation.isPending}
              style={{
                padding: '0.5rem 1rem',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {signupMutation.isPending ? 'Signing up...' : 'Signup'}
            </button>
            {signupMutation.isError && (
              <div style={{ color: 'red' }}>
                Error: {signupMutation.error?.message || 'Signup failed'}
              </div>
            )}
            {signupMutation.isSuccess && (
              <div style={{ color: 'green' }}>Signup successful!</div>
            )}
          </div>
        </div>
      )}

      {/* Logout */}
      {isAuthenticated && (
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            style={{
              padding: '0.5rem 1rem',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#e3f2fd', borderRadius: '4px' }}>
        <h3>Test Instructions</h3>
        <p>1. Try logging in with the test credentials (pre-filled)</p>
        <p>2. Check localStorage for tokens after login</p>
        <p>3. Try logging out and verify tokens are cleared</p>
        <p>4. Check browser console for any errors</p>
      </div>
    </div>
  );
}
