import { expect, it } from 'vitest';
import { validateCredentials } from './authForm';

it('validates email before every request', () => {
  for (const mode of ['sign-in', 'sign-up', 'forgot-password'] as const) {
    expect(validateCredentials(mode, 'wrong-address', 'password1', 'password1')).toBe('auth.formErrors.email');
  }
});
it('requires a matching password of at least eight characters for signup', () => {
  expect(validateCredentials('sign-up', 'test@example.com', 'short', 'short')).toBe('auth.formErrors.passwordTooShort');
  expect(validateCredentials('sign-up', 'test@example.com', 'password1', 'password2')).toBe('auth.formErrors.passwordMismatch');
  expect(validateCredentials('sign-up', ' test@example.com ', 'password1', 'password1')).toBeNull();
});
it('does not apply new-password rules to existing accounts or recovery requests', () => {
  expect(validateCredentials('sign-in', 'test@example.com', '', '')).toBe('auth.formErrors.password');
  expect(validateCredentials('sign-in', 'test@example.com', 'short', '')).toBeNull();
  expect(validateCredentials('forgot-password', 'test@example.com', '', '')).toBeNull();
});
