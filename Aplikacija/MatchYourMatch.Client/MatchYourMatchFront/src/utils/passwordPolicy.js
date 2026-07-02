export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters long and include uppercase, lowercase, number and special character.";

export function isStrongPassword(password) {
  const value = password || "";

  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function getPasswordValidationMessage(password) {
  return isStrongPassword(password) ? "" : PASSWORD_POLICY_MESSAGE;
}
