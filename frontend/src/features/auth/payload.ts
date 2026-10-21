export type SignupFormPayload = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type SignupRequestPayload = Pick<SignupFormPayload, 'name' | 'email' | 'password'>;

export function signupRequestPayload({ name, email, password }: SignupFormPayload): SignupRequestPayload {
  return { name, email, password };
}
