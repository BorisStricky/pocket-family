// src/features/auth/components/AuthForm.tsx
// Reusable authentication form for login and signup

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TextField, Button, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { IS_DEMO_MODE } from '@/lib/constants';

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
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isSignup = mode === 'signup';

  const validate = () => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!email) {
      errors.email = t('validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('validation.emailInvalid');
    }

    // Password validation
    if (!password) {
      errors.password = t('validation.passwordRequired');
    } else if (password.length < 6) {
      errors.password = t('validation.passwordMinLength');
    }

    // Name validation (signup only)
    if (isSignup && !name) {
      errors.name = t('validation.nameRequired');
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
        mx: 'auto',
      }}
    >
      <Typography variant="h4" component="h1" sx={{ mb: 2, textAlign: 'center' }}>
        {isSignup ? t('auth.createAccount') : t('auth.welcomeBack')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isSignup && (
        <TextField
          label={t('auth.name')}
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
        label={t('auth.email')}
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
        label={t('auth.password')}
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
          t('auth.signUp')
        ) : (
          t('auth.logIn')
        )}
      </Button>

      {/* Hide the cross-link to /signup when running as the public demo —
          account creation is disabled there. Still surface the link back to
          /login from the (informational) signup page. */}
      {(!IS_DEMO_MODE || isSignup) && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2">
            {isSignup ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}{' '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              style={{ color: '#044218', textDecoration: 'none' }}
            >
              {isSignup ? t('auth.logInLink') : t('auth.signUpLink')}
            </Link>
          </Typography>
        </Box>
      )}
    </Box>
  );
}
