import { getSupabaseClient } from '@/lib/supabase/client';

export type AccountState = 'active' | 'deleting' | 'onboarding' | 'suspended';
export type SupportedLocale = 'en' | 'ko';

export type AuthFailureCode =
  | 'ACCOUNT_BLOCKED'
  | 'AUTH_LINK_INVALID'
  | 'AUTHENTICATION_REQUIRED'
  | 'CONFIGURATION_REQUIRED'
  | 'EMAIL_DELIVERY_UNAVAILABLE'
  | 'EMAIL_NOT_CONFIRMED'
  | 'EMAIL_RATE_LIMITED'
  | 'HANDLE_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_EMAIL'
  | 'INVALID_ONBOARDING_INPUT'
  | 'PASSWORD_UNCHANGED'
  | 'REQUEST_FAILED'
  | 'SIGNUP_DISABLED'
  | 'USER_ALREADY_REGISTERED'
  | 'WEAK_PASSWORD';

export class AuthFlowError extends Error {
  readonly code: AuthFailureCode;

  constructor(code: AuthFailureCode) {
    super(code);
    this.code = code;
    this.name = 'AuthFlowError';
  }
}

export type OnboardingInput = {
  displayName: string;
  handle: string;
  locale: SupportedLocale;
};

const handlePattern = /^[a-z0-9][a-z0-9_]{2,29}$/;
const developmentLegalVersion = 'development-unpublished';

const isAccountState = (value: unknown): value is AccountState =>
  value === 'active' || value === 'deleting' || value === 'onboarding' || value === 'suspended';

const getErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
};

export const toAuthFailure = (error: unknown): AuthFlowError => {
  if (error instanceof AuthFlowError) return error;

  switch (getErrorCode(error)) {
    case 'bad_code_verifier':
    case 'bad_jwt':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'otp_expired':
    case 'session_expired':
      return new AuthFlowError('AUTH_LINK_INVALID');
    case 'email_address_invalid':
      return new AuthFlowError('INVALID_EMAIL');
    case 'email_address_not_authorized':
      return new AuthFlowError('EMAIL_DELIVERY_UNAVAILABLE');
    case 'email_not_confirmed':
      return new AuthFlowError('EMAIL_NOT_CONFIRMED');
    case 'invalid_credentials':
      return new AuthFlowError('INVALID_CREDENTIALS');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AuthFlowError('EMAIL_RATE_LIMITED');
    case 'same_password':
      return new AuthFlowError('PASSWORD_UNCHANGED');
    case 'signup_disabled':
      return new AuthFlowError('SIGNUP_DISABLED');
    case 'user_already_exists':
      return new AuthFlowError('USER_ALREADY_REGISTERED');
    case 'weak_password':
      return new AuthFlowError('WEAK_PASSWORD');
    case '23505':
      return new AuthFlowError('HANDLE_TAKEN');
    case '22023':
      return new AuthFlowError('INVALID_ONBOARDING_INPUT');
    case '42501':
      return new AuthFlowError('AUTHENTICATION_REQUIRED');
    case 'P0001':
      return new AuthFlowError('ACCOUNT_BLOCKED');
    default:
      return new AuthFlowError('REQUEST_FAILED');
  }
};

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const parseAccountState = (value: unknown): AccountState => {
  if (!isAccountState(value)) throw new AuthFlowError('REQUEST_FAILED');
  return value;
};

const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const isValidHandle = (handle: string): boolean => handlePattern.test(handle.trim().toLowerCase());

export const bootstrapAccount = async (): Promise<AccountState> => {
  const { data, error } = await configuredClient().rpc('bootstrap_account');
  if (error) throw toAuthFailure(error);
  return parseAccountState(data);
};

export const getActiveProfileLocale = async (): Promise<SupportedLocale | null> => {
  const { data, error } = await configuredClient().from('profiles').select('locale').maybeSingle();
  if (error) throw toAuthFailure(error);

  return data?.locale === 'ko' ? 'ko' : data?.locale === 'en' ? 'en' : null;
};

export const completeOnboarding = async (input: OnboardingInput): Promise<AccountState> => {
  const handle = input.handle.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!isValidHandle(handle) || displayName.length < 1 || displayName.length > 80) {
    throw new AuthFlowError('INVALID_ONBOARDING_INPUT');
  }

  const { data, error } = await configuredClient().rpc('complete_onboarding', {
    accepted_age_gate_version: developmentLegalVersion,
    accepted_privacy_notice_version: developmentLegalVersion,
    accepted_terms_version: developmentLegalVersion,
    age_confirmed: true,
    profile_display_name: displayName,
    profile_handle: handle,
    profile_locale: input.locale,
    profile_time_zone: deviceTimeZone(),
  });

  if (error) throw toAuthFailure(error);
  return parseAccountState(data);
};
