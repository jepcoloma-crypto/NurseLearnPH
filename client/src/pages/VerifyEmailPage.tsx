import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { authApi } from "@/services/api";
import { Loader2, MailCheck, AlertCircle, Clock } from "lucide-react";

type VerifyState =
  | { kind: "checking" }
  | { kind: "active"; message: string }
  | { kind: "pending"; message: string }
  | { kind: "error"; message: string };

type ServerResponse = { message?: string; error?: { message?: string } };

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<VerifyState>({ kind: "checking" });
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resendMessage, setResendMessage] = useState("");
  const [resendUrl, setResendUrl] = useState<string | undefined>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setState({
        kind: "error",
        message:
          "This verification link is missing its token. Please open the link from your email again.",
      });
      return;
    }

    authApi
      .verifyEmail(token)
      .then((res) => {
        const data = res.data?.data ?? {};
        const kind = data.status === "active" ? "active" : "pending";
        setState({
          kind,
          message:
            data.message ||
            (kind === "active"
              ? "Your email is verified and your account is active."
              : "Your email is verified. Your account is awaiting administrator approval."),
        });
      })
      .catch((err: unknown) => {
        let msg =
          "This verification link is invalid or has expired. Request a new one below.";
        if (err && typeof err === "object" && "response" in err) {
          const axiosErr = err as { response?: { data?: ServerResponse } };
          msg =
            axiosErr.response?.data?.error?.message ||
            axiosErr.response?.data?.message ||
            msg;
        }
        setState({ kind: "error", message: msg });
      });
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendState("sending");
    try {
      const res = await authApi.resendVerification(resendEmail.trim());
      const data = res.data?.data ?? {};
      setResendMessage(
        data.message ||
          "If that email address is awaiting verification, a new link has been sent."
      );
      setResendUrl(
        data.verificationUrl
          ? `${data.verificationUrl}`
          : undefined
      );
      if (data.verificationUrl) {
        setResendMessage(
          "A new verification link was created. Email is not configured on this server — use this link:"
        );
      }
      setResendState("sent");
      toast.success("Verification email resent");
    } catch {
      setResendMessage(
        "Could not send the verification email right now. Please try again in a moment."
      );
      setResendState("error");
    }
  };

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
        {content}
      </div>
    </div>
  );

  if (state.kind === "checking") {
    return shell(
      <>
        <Loader2 className="mx-auto text-primary-600 animate-spin mb-3" size={36} />
        <h1 className="text-xl font-semibold text-gray-800">Verifying your email…</h1>
      </>
    );
  }

  if (state.kind === "active") {
    return shell(
      <>
        <MailCheck className="mx-auto text-primary-600 mb-3" size={40} />
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Email verified</h1>
        <p className="text-sm text-gray-600 mb-6">{state.message}</p>
        <Link
          to="/login"
          className="inline-block w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Sign in
        </Link>
      </>
    );
  }

  if (state.kind === "pending") {
    return shell(
      <>
        <Clock className="mx-auto text-amber-500 mb-3" size={40} />
        <h1 className="text-xl font-semibold text-gray-800 mb-2">
          Waiting for approval
        </h1>
        <p className="text-sm text-gray-600 mb-6">{state.message}</p>
        <Link
          to="/login"
          className="inline-block w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Back to Sign In
        </Link>
      </>
    );
  }

  return shell(
    <>
      <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        Verification failed
      </h1>
      <p className="text-sm text-gray-600 mb-6">{state.message}</p>

      {resendState === "sent" ? (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 text-left">
          <p>{resendMessage}</p>
          {resendUrl && (
            <a
              href={resendUrl}
              className="underline break-all mt-1 inline-block"
              data-testid="dev-verification-link"
            >
              {resendUrl}
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={handleResend} className="space-y-3 text-left">
          <label className="block text-sm font-medium">
            Enter your email to get a new link
          </label>
          <input
            type="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {resendState === "error" && (
            <p className="text-red-500 text-xs">{resendMessage}</p>
          )}
          <button
            type="submit"
            disabled={resendState === "sending"}
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-60"
          >
            {resendState === "sending" ? "Sending…" : "Resend verification email"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link to="/login" className="text-primary-600 font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </>
  );
}
