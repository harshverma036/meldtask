import { useAuth } from "@/hooks/useAuth";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";

export function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      try {
        await loginWithGoogle(credentialResponse.credential);
      } catch (err) {
        console.error("Login failed:", err);
      }
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.error("Google Sign-In error")}
      theme="filled_black"
      size="large"
      shape="pill"
      text="signin_with"
    />
  );
}
