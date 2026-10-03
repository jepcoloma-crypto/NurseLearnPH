import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { authApi } from "@/services/api";
import { UserPlus, AlertCircle, MailCheck } from "lucide-react";

const schema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be at most 50 characters"),
    email: z.string().email("Enter a valid email address"),
    firstName: z.string().min(1, "First name is required").max(100),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1, "Last name is required").max(100),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

type ServerResponse = {
  message?: string;
  verificationUrl?: string;
  error?: { message?: string };
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<{
    enabled?: boolean;
    requireApproval?: boolean;
  } | null>(null);
  const [done, setDone] = useState<{
    message: string;
    verificationUrl?: string;
  } | null>(null);

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    let cancelled = false;
    authApi
      .signupConfig()
      .then((res) => {
        if (!cancelled) setConfig(res.data?.data ?? { enabled: false });
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.register({
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        ...(data.middleName?.trim() ? { middleName: data.middleName.trim() } : {}),
      });
      const payload: ServerResponse = res.data?.data ?? {};
      setDone({
        message:
          payload.message ||
          "Registration successful. Check your email to verify your account.",
        verificationUrl: payload.verificationUrl,
      });
      toast.success("Registration successful");
    } catch (err: unknown) {
      let msg = "Registration failed. Please try again.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: ServerResponse } };
        msg = axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (config && config.enabled === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="mx-auto text-amber-500 mb-3" size={32} />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            Registration is disabled
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Self-signup is turned off for this deployment. Please contact the
            program administrator to be given an account.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <MailCheck className="mx-auto text-primary-600 mb-3" size={36} />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            Check your email
          </h1>
          <p className="text-sm text-gray-600 mb-4">{done.message}</p>
          {config?.requireApproval && (
            <p className="text-sm text-gray-500 mb-4">
              After verifying, an administrator will activate your account —
              you will receive an email once you can sign in.
            </p>
          )}
          {done.verificationUrl && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <p className="mb-1 font-medium">
                Email is not configured on this server — use this link:
              </p>
              <a
                href={done.verificationUrl}
                className="underline break-all"
                data-testid="dev-verification-link"
              >
                {done.verificationUrl}
              </a>
            </div>
          )}
          <Link
            to="/login"
            className="inline-block w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const field =
    "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">NurseLearn PH</h1>
          <p className="text-gray-500 mt-2">Nursing Competency & Learning Platform</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="text-primary-600" size={20} />
            <h2 className="text-xl font-semibold">Create your account</h2>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input data-testid="signup-username" {...register("username")} className={field} placeholder="e.g. juandelacruz" autoComplete="username" />
              {formState.errors.username && (
                <p className="text-red-500 text-xs mt-1">{formState.errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input data-testid="signup-email" type="email" {...register("email")} className={field} placeholder="you@example.com" autoComplete="email" />
              {formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{formState.errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input data-testid="signup-firstName" {...register("firstName")} className={field} />
                {formState.errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input data-testid="signup-lastName" {...register("lastName")} className={field} />
                {formState.errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Middle Name (optional)</label>
              <input data-testid="signup-middleName" {...register("middleName")} className={field} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input data-testid="signup-password" type="password" {...register("password")} className={field} placeholder="Min 8 characters" autoComplete="new-password" />
              {formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input data-testid="signup-confirmPassword" type="password" {...register("confirmPassword")} className={field} placeholder="Repeat password" autoComplete="new-password" />
              {formState.errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
