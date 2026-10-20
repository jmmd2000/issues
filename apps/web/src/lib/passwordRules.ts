/** The fewest characters a new password can have. The API enforces the same number. */
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordChecks {
  longEnough: boolean;
  matches: boolean;
}

/** Checks the new password against its rules. An empty pair does not count as matching. */
export function checkNewPassword(newPassword: string, confirmPassword: string): PasswordChecks {
  return {
    longEnough: newPassword.length >= MIN_PASSWORD_LENGTH,
    matches: newPassword.length > 0 && newPassword === confirmPassword,
  };
}

/** The form can be sent once there is a current password and both rules are met. */
export function canChangePassword(currentPassword: string, newPassword: string, confirmPassword: string): boolean {
  const { longEnough, matches } = checkNewPassword(newPassword, confirmPassword);
  return currentPassword.length > 0 && longEnough && matches;
}
