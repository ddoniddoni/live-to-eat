export type AuthMode = 'forgot-password' | 'sign-in' | 'sign-up';
export type FormErrorKey =
  | 'auth.formErrors.email'
  | 'auth.formErrors.password'
  | 'auth.formErrors.passwordMismatch'
  | 'auth.formErrors.passwordTooShort';

export function validateCredentials(
  mode: AuthMode, email: string, password: string, confirmation: string,
): FormErrorKey | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'auth.formErrors.email';
  if (mode === 'forgot-password') return null;
  if (!password) return 'auth.formErrors.password';
  if (mode === 'sign-up') {
    if (password.length < 8) return 'auth.formErrors.passwordTooShort';
    if (password !== confirmation) return 'auth.formErrors.passwordMismatch';
  }
  return null;
}
