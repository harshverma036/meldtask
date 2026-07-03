import { useAuth } from "@/hooks/useAuth";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { toast } from "react-toastify";
import axios from "axios";

export function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;

    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        const message = err.response.data.error as string;

        if (message.includes("pending approval")) {
          toast.warn(message);
        } else if (message.includes("domain") || message.includes("not authorized")) {
          toast.error(message);
        } else if (message.includes("rejected")) {
          toast.error(message);
        } else {
          toast.error("Login failed. Please try again.");
        }
      } else {
        toast.error("Login failed. Please try again.");
      }
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => toast.error("Google Sign-In failed. Please try again.")}
      theme="filled_black"
      size="large"
      shape="pill"
      text="signin_with"
    />
  );
}
