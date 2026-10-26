export function validatePasswordChange(password,confirmPassword){
 if(String(password||'').length<12)return 'Use at least 12 characters.';
 if(password!==confirmPassword)return 'Passwords do not match.';
 return '';
}
