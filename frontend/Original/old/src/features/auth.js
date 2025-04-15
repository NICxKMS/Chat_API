import { lazy } from 'react';

// Auth components with explicit chunk names for better tracking
export const LoginModal = lazy(() => import(/* webpackChunkName: "auth-login" */ '../components/auth/LoginModal'));
export const AuthButton = lazy(() => import(/* webpackChunkName: "auth-button" */ '../components/auth/AuthButton'));

// Add other auth-related components here
// export const SignupForm = lazy(() => import(/* webpackChunkName: "auth-signup" */ '../components/auth/SignupForm'));
// export const ResetPassword = lazy(() => import(/* webpackChunkName: "auth-reset" */ '../components/auth/ResetPassword'));

// Bundle for preloading
export const authComponents = [
  () => import(/* webpackChunkName: "auth-login" */ '../components/auth/LoginModal'),
  () => import(/* webpackChunkName: "auth-button" */ '../components/auth/AuthButton')
]; 