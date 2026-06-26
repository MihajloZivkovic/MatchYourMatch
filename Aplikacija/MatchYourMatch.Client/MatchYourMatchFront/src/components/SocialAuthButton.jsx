export default function SocialAuthButton({
  provider,
  icon,
  children,
  loading = false,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type='button'
      className={`social-auth-button social-auth-button--${provider}`}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      <span className='social-auth-button__icon' aria-hidden='true'>
        {icon}
      </span>
      <span className='social-auth-button__label'>{children}</span>
      {loading && (
        <span className='social-auth-button__spinner' aria-hidden='true' />
      )}
    </button>
  );
}
