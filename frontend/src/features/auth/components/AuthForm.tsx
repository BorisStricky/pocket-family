// src/features/auth/components/AuthForm.tsx
// Reusable authentication form for login and signup

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TextField, Button, Box, Typography, Alert, CircularProgress } from '@mui/material';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit: (data: { email: string; password: string; name?: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * AuthForm component
 * Reusable form for login and signup with validation
 */
export function AuthForm({ mode, onSubmit, isLoading = false, error = null }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isSignup = mode === 'signup';

  const validate = () => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // Name validation (signup only)
    if (isSignup && !name) {
      errors.name = 'Name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data: { email: string; password: string; name?: string } = {
      email,
      password,
    };

    if (isSignup) {
      data.name = name;
    }

    onSubmit(data);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        maxWidth: 400,
      }}
    >
      <Typography variant="h4" component="h1" sx={{ mb: 2, textAlign: 'center' }}>
        {isSignup ? 'Create Account' : 'Welcome Back'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isSignup && (
        <TextField
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!validationErrors.name}
          helperText={validationErrors.name}
          disabled={isLoading}
          fullWidth
          required
        />
      )}

      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={!!validationErrors.email}
        helperText={validationErrors.email}
        disabled={isLoading}
        fullWidth
        required
      />

      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={!!validationErrors.password}
        helperText={validationErrors.password}
        disabled={isLoading}
        fullWidth
        required
      />

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={isLoading}
        fullWidth
        sx={{ mt: 2 }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : isSignup ? (
          'Sign Up'
        ) : (
          'Log In'
        )}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link
            to={isSignup ? '/login' : '/signup'}
            style={{ color: '#1976d2', textDecoration: 'none' }}
          >
            {isSignup ? 'Log in' : 'Sign up'}
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
